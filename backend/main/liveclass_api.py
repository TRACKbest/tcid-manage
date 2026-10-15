from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core import signing
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models
from .serializers import LiveClassPollSerializer, LiveClassroomSerializer


TOKEN_SALT = 'main.liveclass.participant'


def _is_approved_student(student_id, course_id):
    return models.StudentCourseEnrollment.objects.filter(
        student_id=student_id,
        course_id=course_id,
        status=models.StudentCourseEnrollment.STATUS_APPROVED,
    ).exists()


def _broadcast(classroom_id, payload):
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'live_classroom_{classroom_id}',
            {'type': 'room.event', 'payload': payload},
        )


def _poll_payload(poll):
    return LiveClassPollSerializer(poll).data


def _notify_enrolled_students(classroom, subject, message):
    student_ids = models.StudentCourseEnrollment.objects.filter(
        course_id=classroom.course_id,
        student_id__isnull=False,
        status=models.StudentCourseEnrollment.STATUS_APPROVED,
    ).values_list('student_id', flat=True).distinct()
    models.Notification.objects.bulk_create([
        models.Notification(
            student_id=student_id,
            subject=subject,
            message=message,
            link=f'/live-classroom/{classroom.course_id}',
        )
        for student_id in student_ids
    ])


class CourseLiveClassrooms(APIView):
    def get(self, request, course_id):
        course = get_object_or_404(models.Course, pk=course_id)
        teacher_id = request.query_params.get('teacher_id')
        student_id = request.query_params.get('student_id')

        if teacher_id:
            if str(course.teacher_id) != teacher_id:
                raise PermissionDenied('Seul le formateur de la formation peut consulter ces sessions.')
        elif student_id:
            if not _is_approved_student(student_id, course_id):
                raise PermissionDenied('Une inscription approuvée à la formation est nécessaire.')
        else:
            raise PermissionDenied('Une identité de formateur ou d’apprenant est nécessaire.')

        sessions = models.LiveClassroom.objects.filter(course=course)
        return Response(LiveClassroomSerializer(sessions, many=True).data)

    def post(self, request, course_id):
        course = get_object_or_404(models.Course, pk=course_id)
        if str(course.teacher_id) != str(request.data.get('teacher_id', '')):
            raise PermissionDenied('Seul le formateur de la formation peut programmer une session.')

        serializer = LiveClassroomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        classroom = serializer.save(course=course)
        if classroom.scheduled_at:
            scheduled_time = timezone.localtime(classroom.scheduled_at).strftime('%d/%m/%Y à %H:%M')
            _notify_enrolled_students(
                classroom,
                'Classe virtuelle programmée',
                f'La session « {classroom.title} » de la formation {course.title} est prévue le {scheduled_time}.',
            )
        return Response(LiveClassroomSerializer(classroom).data, status=status.HTTP_201_CREATED)


class LiveClassroomAction(APIView):
    def post(self, request, classroom_id, action):
        classroom = get_object_or_404(
            models.LiveClassroom.objects.select_related('course'),
            pk=classroom_id,
        )
        if str(classroom.course.teacher_id) != str(request.data.get('teacher_id', '')):
            raise PermissionDenied('Seul le formateur de la formation peut gérer cette session.')

        if action == 'start':
            with transaction.atomic():
                classroom = get_object_or_404(
                    models.LiveClassroom.objects.select_for_update().select_related('course'),
                    pk=classroom_id,
                )
                if classroom.status == models.LiveClassroom.STATUS_ENDED:
                    return Response({'detail': 'Cette session est terminée.'}, status=status.HTTP_409_CONFLICT)
                if classroom.status != models.LiveClassroom.STATUS_LIVE:
                    classroom.status = models.LiveClassroom.STATUS_LIVE
                    classroom.started_at = timezone.now()
                    classroom.save(update_fields=['status', 'started_at'])
                    _notify_enrolled_students(
                        classroom,
                        'Classe virtuelle en direct',
                        f'La session « {classroom.title} » de la formation {classroom.course.title} a commencé. Rejoignez-la maintenant.',
                    )
            return Response(LiveClassroomSerializer(classroom).data)

        if action == 'end':
            should_broadcast_end = False
            with transaction.atomic():
                classroom = get_object_or_404(
                    models.LiveClassroom.objects.select_for_update().select_related('course'),
                    pk=classroom_id,
                )
                if classroom.status != models.LiveClassroom.STATUS_ENDED:
                    was_live = classroom.status == models.LiveClassroom.STATUS_LIVE
                    classroom.status = models.LiveClassroom.STATUS_ENDED
                    classroom.ended_at = timezone.now()
                    classroom.save(update_fields=['status', 'ended_at'])
                    if was_live:
                        _notify_enrolled_students(
                            classroom,
                            'Classe virtuelle terminée',
                            f'La session « {classroom.title} » de la formation {classroom.course.title} est terminée.',
                        )
                        should_broadcast_end = True
            if should_broadcast_end:
                _broadcast(classroom.id, {'type': 'session_ended'})
            return Response(LiveClassroomSerializer(classroom).data)

        return Response({'detail': 'Action de session inconnue.'}, status=status.HTTP_404_NOT_FOUND)


class LiveClassroomJoin(APIView):
    def post(self, request, classroom_id):
        classroom = get_object_or_404(models.LiveClassroom, pk=classroom_id)
        if classroom.status != models.LiveClassroom.STATUS_LIVE:
            return Response({'detail': 'Cette session n’est pas en direct.'}, status=status.HTTP_409_CONFLICT)

        teacher_id = request.data.get('teacher_id')
        student_id = request.data.get('student_id')
        if teacher_id:
            if str(classroom.course.teacher_id) != str(teacher_id):
                raise PermissionDenied('Seul le formateur de la formation peut rejoindre avec ce rôle.')
            teacher = get_object_or_404(models.Teacher, pk=teacher_id)
            role, participant_id, display_name = 'teacher', teacher.pk, teacher.full_name
        elif student_id:
            student = get_object_or_404(models.Student, pk=student_id)
            if not _is_approved_student(student.pk, classroom.course_id):
                raise PermissionDenied('Une inscription approuvée à la formation est nécessaire.')
            role, participant_id, display_name = 'student', student.pk, student.fullname
        else:
            raise PermissionDenied('Une identité de formateur ou d’apprenant est nécessaire.')

        token = signing.dumps(
            {'classroom_id': classroom.pk, 'role': role, 'participant_id': participant_id},
            salt=TOKEN_SALT,
            compress=True,
        )
        return Response({'token': token, 'role': role, 'display_name': display_name})


class LiveClassPollListCreate(APIView):
    def get(self, request, classroom_id):
        classroom = get_object_or_404(models.LiveClassroom, pk=classroom_id)
        teacher_id = request.query_params.get('teacher_id')
        student_id = request.query_params.get('student_id')
        if teacher_id:
            if str(classroom.course.teacher_id) != teacher_id:
                raise PermissionDenied('Seul le formateur de la formation peut consulter ces sondages.')
        elif not student_id or not _is_approved_student(student_id, classroom.course_id):
            raise PermissionDenied('Une inscription approuvée à la formation est nécessaire.')

        polls = classroom.polls.all()
        return Response(LiveClassPollSerializer(polls, many=True).data)

    def post(self, request, classroom_id):
        classroom = get_object_or_404(models.LiveClassroom, pk=classroom_id)
        if str(classroom.course.teacher_id) != str(request.data.get('teacher_id', '')):
            raise PermissionDenied('Seul le formateur de la formation peut créer un sondage.')
        if classroom.status != models.LiveClassroom.STATUS_LIVE:
            return Response({'detail': 'Les sondages sont disponibles uniquement pendant une session en direct.'}, status=status.HTTP_409_CONFLICT)

        serializer = LiveClassPollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            classroom.polls.filter(is_active=True).update(is_active=False)
            poll = serializer.save(classroom=classroom)
        payload = {'type': 'poll_started', 'poll': _poll_payload(poll)}
        _broadcast(classroom.id, payload)
        return Response(payload['poll'], status=status.HTTP_201_CREATED)


class LiveClassPollVote(APIView):
    def post(self, request, poll_id):
        poll = get_object_or_404(models.LiveClassPoll.objects.select_related('classroom__course'), pk=poll_id)
        classroom = poll.classroom
        if classroom.status != models.LiveClassroom.STATUS_LIVE or not poll.is_active:
            return Response({'detail': 'Ce sondage est fermé.'}, status=status.HTTP_409_CONFLICT)

        student = get_object_or_404(models.Student, pk=request.data.get('student_id'))
        if not _is_approved_student(student.pk, classroom.course_id):
            raise PermissionDenied('Une inscription approuvée à la formation est nécessaire.')
        try:
            option_index = int(request.data.get('option_index'))
        except (TypeError, ValueError):
            return Response({'detail': 'Sélectionnez une option de sondage valide.'}, status=status.HTTP_400_BAD_REQUEST)
        if option_index < 0 or option_index >= len(poll.options):
            return Response({'detail': 'L’option sélectionnée n’existe pas.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                models.LiveClassPollVote.objects.create(
                    poll=poll,
                    student=student,
                    option_index=option_index,
                )
        except IntegrityError:
            return Response({'detail': 'Vous avez déjà répondu à ce sondage.'}, status=status.HTTP_409_CONFLICT)

        payload = {'type': 'poll_results', 'poll': _poll_payload(poll)}
        _broadcast(classroom.id, payload)
        return Response(payload['poll'])