import re

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from . import models


REFERENCE_PATTERN = re.compile(r'^[A-Z0-9.\-_/]{4,64}$')


class PaymentError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def payment_methods():
    return [
        {
            'code': code,
            'label': label,
            'number': settings.PAYMENT_ACCOUNTS[code]['number'],
            'holder': settings.PAYMENT_ACCOUNTS[code]['holder'],
            'color': settings.PAYMENT_ACCOUNTS[code]['color'],
        }
        for code, label in models.CoursePayment.METHOD_CHOICES
        if code in settings.PAYMENT_ACCOUNTS
    ]


def has_course_access(student_id, course):
    if not student_id:
        return False
    return models.StudentCourseEnrollment.objects.filter(
        student_id=student_id,
        course=course,
        status=models.StudentCourseEnrollment.STATUS_APPROVED,
    ).exists()


def free_chapter_ids(course):
    first_id = course.first_chapter_id()
    free_ids = set(course.course_chapters.filter(is_free_preview=True).values_list('id', flat=True))
    if first_id:
        free_ids.add(first_id)
    return free_ids


def submit_payment(course, student, method, amount, reference, payer_phone=''):
    if not course.is_paid:
        raise PaymentError('Cette formation est gratuite : demandez simplement l’accès.')
    if method not in dict(models.CoursePayment.METHOD_CHOICES):
        raise PaymentError('Choisissez Orange Money, Airtel Money ou MVola.')
    reference = models.CoursePayment.normalize_reference(reference)
    if not REFERENCE_PATTERN.match(reference):
        raise PaymentError('La référence doit contenir entre 4 et 64 caractères (chiffres ou lettres), par exemple 64494665.')
    try:
        amount = int(str(amount).replace(' ', ''))
    except (TypeError, ValueError):
        raise PaymentError('Indiquez le montant payé en ariary.')
    if amount < course.price:
        raise PaymentError(f'Le montant payé doit être au moins égal au prix de la formation ({course.price} Ar).')
    payer_phone = re.sub(r'[^\d+]', '', str(payer_phone or ''))[:20]

    if has_course_access(student.pk, course):
        raise PaymentError('Vous avez déjà accès à cette formation.', status=409)
    if models.CoursePayment.objects.filter(
        course=course, student=student, status=models.CoursePayment.STATUS_PENDING,
    ).exists():
        raise PaymentError('Un paiement est déjà en attente de validation pour cette formation.', status=409)

    try:
        with transaction.atomic():
            payment = models.CoursePayment.objects.create(
                course=course,
                student=student,
                method=method,
                amount=amount,
                expected_amount=course.price,
                reference=reference,
                payer_phone=payer_phone,
            )
            models.Notification.objects.create(
                student=student,
                subject='Paiement envoyé pour vérification',
                message=f'Votre paiement de {amount} Ar (réf. {reference}) pour « {course.title} » sera vérifié par l’administrateur.',
                link='/my-payments',
            )
    except IntegrityError:
        raise PaymentError('Cette référence de paiement a déjà été utilisée.', status=409)
    return payment


@transaction.atomic
def validate_payment(payment_id, user, reference, amount_received):
    payment = (
        models.CoursePayment.objects.select_for_update()
        .select_related('course__teacher', 'student')
        .get(pk=payment_id)
    )
    if payment.status != models.CoursePayment.STATUS_PENDING:
        raise PaymentError('Ce paiement a déjà été traité.', status=409)
    if models.CoursePayment.normalize_reference(reference) != payment.reference:
        raise PaymentError('La référence saisie ne correspond pas à celle envoyée par l’apprenant. Vérifiez le SMS de confirmation.')
    try:
        amount_received = int(str(amount_received).replace(' ', ''))
    except (TypeError, ValueError):
        raise PaymentError('Indiquez le montant réellement reçu.')
    if amount_received < payment.expected_amount:
        raise PaymentError(f'Le montant reçu ({amount_received} Ar) est inférieur au prix de la formation ({payment.expected_amount} Ar).')

    payment.status = models.CoursePayment.STATUS_VALIDATED
    payment.amount_received = amount_received
    payment.reviewed_by = user
    payment.reviewed_at = timezone.now()
    payment.admin_note = ''
    payment.save(update_fields=['status', 'amount_received', 'reviewed_by', 'reviewed_at', 'admin_note'])

    enrollment, _ = models.StudentCourseEnrollment.objects.get_or_create(
        course=payment.course,
        student=payment.student,
        defaults={'status': models.StudentCourseEnrollment.STATUS_APPROVED},
    )
    if enrollment.status != models.StudentCourseEnrollment.STATUS_APPROVED:
        enrollment.status = models.StudentCourseEnrollment.STATUS_APPROVED
        enrollment.save(update_fields=['status'])

    models.Notification.objects.bulk_create([
        models.Notification(
            student=payment.student,
            subject='Paiement validé 🎉',
            message=f'Votre paiement pour « {payment.course.title} » est validé. Toutes les vidéos sont débloquées.',
            link=f'/mini/{payment.course_id}',
        ),
        models.Notification(
            teacher=payment.course.teacher,
            subject='Nouvel apprenant inscrit',
            message=f'{payment.student.fullname} a payé {amount_received} Ar pour « {payment.course.title} ».',
            link='/teacher-payments',
        ),
    ])
    return payment


@transaction.atomic
def reject_payment(payment_id, user, note):
    payment = (
        models.CoursePayment.objects.select_for_update()
        .select_related('course', 'student')
        .get(pk=payment_id)
    )
    if payment.status != models.CoursePayment.STATUS_PENDING:
        raise PaymentError('Ce paiement a déjà été traité.', status=409)
    note = str(note or '').strip()[:300]
    if not note:
        raise PaymentError('Expliquez à l’apprenant pourquoi le paiement est refusé.')
    payment.status = models.CoursePayment.STATUS_REJECTED
    payment.admin_note = note
    payment.reviewed_by = user
    payment.reviewed_at = timezone.now()
    payment.save(update_fields=['status', 'admin_note', 'reviewed_by', 'reviewed_at'])
    models.Notification.objects.create(
        student=payment.student,
        subject='Paiement refusé',
        message=f'Votre paiement (réf. {payment.reference}) pour « {payment.course.title} » a été refusé : {note}',
        link=f'/detail/{payment.course_id}',
    )
    return payment
