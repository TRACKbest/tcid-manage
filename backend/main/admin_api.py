import json
from datetime import date, datetime, time
from functools import wraps

from django import forms
from django.apps import apps
from django.contrib import admin, messages
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm
from django.contrib.admin.utils import label_for_field, lookup_field
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Count
from django.db.models.fields.files import FieldFile
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from rest_framework.exceptions import ValidationError as SerializerValidationError

from . import models
from .serializers import StudentAssignmentSerializer

HIDDEN_ADMIN_RESOURCES = {('flatpages', 'flatpage')}


class AdminAssignmentForm(forms.ModelForm):
    class Meta:
        model = models.StudentAssignment
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        group_id = self.data.get('group') if self.is_bound else getattr(self.instance, 'group_id', None)
        if group_id:
            self.fields['student'].required = False

    def clean_detail(self):
        try:
            return StudentAssignmentSerializer().validate_detail(self.cleaned_data.get('detail') or '')
        except SerializerValidationError as error:
            raise forms.ValidationError(str(error.detail[0])) from error


def _frequent_ai_questions():
    frequent = (
        models.AIAssistantQuestion.objects
        .filter(normalized_question__gt='', answer__gt='')
        .values('normalized_question')
        .annotate(count=Count('pk'))
        .order_by('-count', 'normalized_question')[:5]
    )
    results = []
    for item in frequent:
        latest = (
            models.AIAssistantQuestion.objects
            .filter(normalized_question=item['normalized_question'], answer__gt='')
            .select_related('course')
            .order_by('-created_at')
            .first()
        )
        if latest:
            results.append({
                'question': ' '.join(latest.question.split()),
                'answer': latest.answer,
                'course': latest.course.title,
                'count': item['count'],
            })
    return results


class AdminConsoleUserCreationForm(AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        fields = (
            'username',
            'first_name',
            'last_name',
            'email',
            'is_active',
            'is_staff',
            'is_superuser',
            'groups',
            'user_permissions',
        )


class AdminConsoleUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        fields = (
            'username',
            'first_name',
            'last_name',
            'email',
            'is_active',
            'is_staff',
            'is_superuser',
            'groups',
            'user_permissions',
        )


def _staff_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'detail': 'Connexion requise pour accéder à cette page.'}, status=401)
        if not request.user.is_staff:
            return JsonResponse({'detail': 'Un accès administrateur est requis.'}, status=403)
        return view(request, *args, **kwargs)
    return wrapped


@ensure_csrf_cookie
@require_GET
def admin_csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


@require_POST
def admin_login(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'La requête est invalide.'}, status=400)

    user = authenticate(
        request,
        username=payload.get('username', '').strip(),
        password=payload.get('password', ''),
    )
    if user is None or not user.is_active or not user.is_staff:
        return JsonResponse({'detail': 'Identifiant ou mot de passe administrateur incorrect.'}, status=401)

    login(request, user)
    return JsonResponse({'username': user.get_username()})


@_staff_required
@require_GET
def admin_session(request):
    return JsonResponse({'username': request.user.get_username()})


@_staff_required
@require_POST
def admin_logout(request):
    logout(request)
    return JsonResponse({'ok': True})


@_staff_required
@require_POST
def admin_approve_account(request, account_type, account_id):
    from .models import Student, Teacher

    account_models = {'student': Student, 'teacher': Teacher}
    model = account_models.get(account_type)
    if model is None:
        return JsonResponse({'detail': 'Type de compte inconnu.'}, status=404)
    account = get_object_or_404(model, pk=account_id, is_approved=False)
    account.is_approved = True
    account.is_active = True
    account.save(update_fields=['is_approved', 'is_active'])
    return JsonResponse({'approved': True, 'id': account.pk})


def _get_registered_model(app_label, model_name):
    if (app_label, model_name) in HIDDEN_ADMIN_RESOURCES:
        raise PermissionDenied
    try:
        model = apps.get_model(app_label, model_name)
    except LookupError:
        raise PermissionDenied
    model_admin = admin.site._registry.get(model)
    if model_admin is None:
        raise PermissionDenied
    return model, model_admin


def _resource_form_class(model, model_admin, request, instance=None):
    if model is get_user_model():
        if instance is None:
            return AdminConsoleUserCreationForm
        return AdminConsoleUserChangeForm
    if model is models.StudentAssignment:
        return AdminAssignmentForm
    return model_admin.get_form(request, instance)


def _safe_value(value):
    if isinstance(value, FieldFile):
        if not value.name:
            return ''
        try:
            return value.url
        except ValueError:
            return ''
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    if hasattr(value, '_meta'):
        return str(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (list, tuple, set)):
        return ', '.join(str(item) for item in value)
    return str(value)


def _display_value(value):
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.strftime('%d/%m/%Y %H:%M')
    if isinstance(value, date):
        return value.strftime('%d/%m/%Y')
    if isinstance(value, time):
        return value.strftime('%H:%M')
    return _safe_value(value)


def _column_name(column):
    return column if isinstance(column, str) else getattr(column, '__name__', str(column))


def _resource_columns(model_admin, request, model):
    columns = []
    for column in model_admin.get_list_display(request):
        name = _column_name(column)
        try:
            label = label_for_field(name, model, model_admin=model_admin)
        except (AttributeError, Exception):
            label = name.replace('_', ' ').title()
        columns.append({'name': name, 'label': str(label)})
    return columns


def _field_schema(form_class, instance=None):
    form = form_class(instance=instance) if instance is not None else form_class()
    fields = []
    for name, field in form.fields.items():
        if name == 'password' or name.endswith('_password'):
            continue

        if isinstance(field, forms.ModelMultipleChoiceField):
            field_type = 'multiselect'
            initial_value = form[name].value() or []
            initial = [str(getattr(value, 'pk', value)) for value in initial_value]
            choices = [
                {'value': str(option.pk), 'label': str(option)}
                for option in field.queryset.all()[:500]
            ]
        elif isinstance(field, forms.ModelChoiceField):
            field_type = 'select'
            initial_value = form[name].value()
            initial = str(getattr(initial_value, 'pk', initial_value) or '')
            choices = [
                {'value': str(option.pk), 'label': str(option)}
                for option in field.queryset.all()[:500]
            ]
        elif isinstance(field, forms.DateTimeField):
            field_type = 'datetime-local'
            initial_value = form[name].value()
            if isinstance(initial_value, datetime):
                if timezone.is_aware(initial_value):
                    initial_value = timezone.localtime(initial_value)
                initial = initial_value.strftime('%Y-%m-%dT%H:%M')
            else:
                initial = initial_value or ''
            choices = []
        elif isinstance(field, forms.DateField):
            field_type = 'date'
            initial_value = form[name].value()
            initial = initial_value.strftime('%Y-%m-%d') if isinstance(initial_value, date) else (initial_value or '')
            choices = []
        elif isinstance(field, forms.TimeField):
            field_type = 'time'
            initial_value = form[name].value()
            initial = initial_value.strftime('%H:%M') if isinstance(initial_value, time) else (initial_value or '')
            choices = []
        elif isinstance(field, forms.FileField):
            field_type = 'file'
            choices = []
        elif isinstance(field, forms.BooleanField):
            field_type = 'boolean'
            choices = []
        elif getattr(field, 'choices', None):
            field_type = 'select'
            choices = [
                {'value': str(value), 'label': str(label)}
                for value, label in field.choices
            ]
        elif isinstance(field.widget, forms.Textarea):
            field_type = 'textarea'
            choices = []
        else:
            field_type = getattr(field.widget, 'input_type', 'text')
            choices = []

        if isinstance(field, forms.FileField):
            initial = ''
        elif isinstance(field, (forms.ModelChoiceField, forms.ModelMultipleChoiceField, forms.DateTimeField, forms.DateField, forms.TimeField)):
            pass
        else:
            initial = form[name].value()
        if hasattr(initial, 'pk'):
            initial = str(initial.pk)

        fields.append({
            'name': name,
            'label': str(field.label or name.replace('_', ' ').title()),
            'type': field_type,
            'required': field.required,
            'disabled': field.disabled,
            'initial': _safe_value(initial),
            'helpText': str(field.help_text or ''),
            'choices': choices,
        })
    return fields


def _model_admin_for_request(request, app_label, model_name):
    model, model_admin = _get_registered_model(app_label, model_name)
    if not model_admin.has_module_permission(request):
        raise PermissionDenied
    return model, model_admin


def _list_display_values(model_admin, request, model, instance):
    values = {}
    for column in model_admin.get_list_display(request):
        name = _column_name(column)
        try:
            _, _, value = lookup_field(column, instance, model_admin)
        except (AttributeError, PermissionDenied, ValueError):
            value = ''
        values[name] = _display_value(value)
    return values


def _resource_data(request, model, model_admin, instance=None):
    form_class = _resource_form_class(model, model_admin, request, instance)
    return {
        'appLabel': model._meta.app_label,
        'modelName': model._meta.model_name,
        'label': str(model._meta.verbose_name_plural).title(),
        'columns': _resource_columns(model_admin, request, model),
        'fields': _field_schema(form_class, instance),
        'canAdd': model_admin.has_add_permission(request),
        'canChange': model_admin.has_change_permission(request, instance),
        'canDelete': model_admin.has_delete_permission(request, instance),
    }


@_staff_required
@require_GET
def admin_resources(request):
    resources = []
    for model, model_admin in admin.site._registry.items():
        if (model._meta.app_label, model._meta.model_name) in HIDDEN_ADMIN_RESOURCES:
            continue
        if not model_admin.has_module_permission(request) or not model_admin.has_view_permission(request):
            continue
        resources.append({
            'appLabel': model._meta.app_label,
            'modelName': model._meta.model_name,
            'label': str(model._meta.verbose_name_plural).title(),
            'count': model_admin.get_queryset(request).count(),
            'pendingCount': model_admin.get_queryset(request).filter(is_approved=False).count()
            if any(field.name == 'is_approved' for field in model._meta.fields) else 0,
        })
    resources.sort(key=lambda item: (item['appLabel'], item['label']))
    return JsonResponse({
        'resources': resources,
        'frequentQuestions': _frequent_ai_questions(),
    })


@_staff_required
@require_http_methods(['GET', 'POST'])
def admin_group_members(request, group_id):
    group = get_object_or_404(models.LearningGroup, pk=group_id)
    if request.method == 'POST':
        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'La requête est invalide.'}, status=400)
        filter_type = payload.get('filter')
        candidate_ids = payload.get('candidateIds', [])
        if not isinstance(candidate_ids, list) or not candidate_ids:
            return JsonResponse({'detail': 'Sélectionnez au moins un membre.'}, status=400)

        if filter_type == 'all_students':
            candidates = models.Student.objects.filter(is_active=True, is_approved=True, pk__in=candidate_ids)
            member_field = 'student'
        elif filter_type == 'course_students':
            course_id = payload.get('courseId')
            if not course_id:
                return JsonResponse({'detail': 'Sélectionnez une formation.'}, status=400)
            candidates = models.Student.objects.filter(
                is_active=True,
                is_approved=True,
                pk__in=candidate_ids,
                enrolled_student__course_id=course_id,
                enrolled_student__status=models.StudentCourseEnrollment.STATUS_APPROVED,
            ).distinct()
            member_field = 'student'
        elif filter_type == 'teachers':
            candidates = models.Teacher.objects.filter(is_active=True, is_approved=True, pk__in=candidate_ids)
            member_field = 'teacher'
        else:
            return JsonResponse({'detail': 'Filtre de membres inconnu.'}, status=400)

        added = 0
        with transaction.atomic():
            for candidate in candidates:
                _, created = models.GroupMembership.objects.get_or_create(
                    group=group,
                    **{member_field: candidate},
                )
                if not created:
                    continue
                added += 1
                if member_field == 'student':
                    models.Notification.objects.create(
                        student=candidate,
                        subject=f'Ajouté au groupe {group.name}',
                        message=f'Vous pouvez maintenant participer à la discussion du groupe {group.name}.',
                        link=f'/groups/{group.pk}',
                    )
        return JsonResponse({'added': added})

    filter_type = request.GET.get('filter', 'all_students')
    course_id = request.GET.get('course_id')
    if filter_type == 'all_students':
        candidates = models.Student.objects.filter(is_active=True, is_approved=True).exclude(
            group_memberships__group=group,
        )
        candidate_rows = [{'id': student.pk, 'name': student.fullname, 'email': student.email} for student in candidates]
    elif filter_type == 'course_students':
        candidates = models.Student.objects.filter(
            is_active=True,
            is_approved=True,
            enrolled_student__course_id=course_id,
            enrolled_student__status=models.StudentCourseEnrollment.STATUS_APPROVED,
        ).exclude(group_memberships__group=group).distinct() if course_id else models.Student.objects.none()
        candidate_rows = [{'id': student.pk, 'name': student.fullname, 'email': student.email} for student in candidates]
    elif filter_type == 'teachers':
        candidates = models.Teacher.objects.filter(is_active=True, is_approved=True).exclude(
            group_memberships__group=group,
        )
        candidate_rows = [{'id': teacher.pk, 'name': teacher.full_name, 'email': teacher.email} for teacher in candidates]
    else:
        return JsonResponse({'detail': 'Filtre de membres inconnu.'}, status=400)

    members = [{
        'id': membership.pk,
        'role': 'Étudiant' if membership.student_id else 'Enseignant',
        'name': membership.student.fullname if membership.student_id else membership.teacher.full_name,
    } for membership in group.memberships.select_related('student', 'teacher')]
    return JsonResponse({
        'group': {'id': group.pk, 'name': group.name},
        'members': members,
        'candidates': candidate_rows,
        'courses': list(models.Course.objects.order_by('title').values('id', 'title')),
    })


@_staff_required
@require_GET
def admin_resource_list(request, app_label, model_name):
    model, model_admin = _model_admin_for_request(request, app_label, model_name)
    if not model_admin.has_view_permission(request):
        return JsonResponse({'detail': 'Vous n’avez pas l’autorisation de consulter ces données.'}, status=403)

    queryset = model_admin.get_queryset(request)
    if request.GET.get('pending') == '1' and any(field.name == 'is_approved' for field in model._meta.fields):
        queryset = queryset.filter(is_approved=False)
    search = request.GET.get('q', '').strip()
    if search:
        queryset, _ = model_admin.get_search_results(request, queryset, search)

    page = max(1, int(request.GET.get('page', '1')))
    page_size = 30
    total = queryset.count()
    instances = queryset[(page - 1) * page_size:page * page_size]
    resource = _resource_data(request, model, model_admin)
    resource['fields'] = []
    rows = [
        {'id': str(instance.pk), 'values': _list_display_values(model_admin, request, model, instance)}
        for instance in instances
    ]
    return JsonResponse({
        'resource': resource,
        'results': rows,
        'total': total,
        'page': page,
        'pageSize': page_size,
    })


@_staff_required
@require_http_methods(['GET', 'POST'])
def admin_resource_detail(request, app_label, model_name, object_id=None):
    model, model_admin = _model_admin_for_request(request, app_label, model_name)
    if object_id == 'new':
        object_id = None
    instance = None
    if object_id is not None:
        instance = get_object_or_404(model_admin.get_queryset(request), pk=object_id)

    if request.method == 'GET':
        if instance is None:
            if not model_admin.has_add_permission(request):
                return JsonResponse({'detail': 'Vous n’avez pas l’autorisation d’ajouter cet élément.'}, status=403)
        elif not model_admin.has_change_permission(request, instance):
            return JsonResponse({'detail': 'Vous n’avez pas l’autorisation de modifier cet élément.'}, status=403)
        return JsonResponse({'resource': _resource_data(request, model, model_admin, instance)})

    action = request.POST.get('_action', 'save')
    if action == 'delete':
        if instance is None or not model_admin.has_delete_permission(request, instance):
            return JsonResponse({'detail': 'Vous n’avez pas l’autorisation de supprimer cet élément.'}, status=403)
        model_admin.delete_model(request, instance)
        return JsonResponse({'deleted': True})

    if instance is None:
        if not model_admin.has_add_permission(request):
            return JsonResponse({'detail': 'Vous n’avez pas l’autorisation d’ajouter cet élément.'}, status=403)
    elif not model_admin.has_change_permission(request, instance):
        return JsonResponse({'detail': 'Vous n’avez pas l’autorisation de modifier cet élément.'}, status=403)

    form_class = _resource_form_class(model, model_admin, request, instance)
    form = form_class(request.POST, request.FILES, instance=instance)
    if not form.is_valid():
        return JsonResponse({'errors': form.errors.get_json_data()}, status=400)

    obj = form.save(commit=False)
    if model is models.StudentAssignment:
        if instance is None and obj.group_id:
            group_students = list(
                models.Student.objects.filter(
                    group_memberships__group_id=obj.group_id,
                    is_active=True,
                    is_approved=True,
                ).distinct()
            )
            if not group_students:
                return JsonResponse({'detail': 'Le groupe ne contient aucun étudiant actif.'}, status=400)
            if not models.GroupMembership.objects.filter(group_id=obj.group_id, teacher=obj.teacher).exists():
                return JsonResponse({'detail': 'L’enseignant doit être membre du groupe pour envoyer le devoir.'}, status=400)
            with transaction.atomic():
                for student in group_students:
                    assignment = models.StudentAssignment.objects.create(
                        teacher=obj.teacher,
                        student=student,
                        group=obj.group,
                        title=obj.title,
                        detail=obj.detail,
                        student_status=False,
                    )
                    models.Notification.objects.create(
                        student=student,
                        subject='Nouveau devoir reçu',
                        message=f'{obj.teacher.full_name} vous a envoyé le devoir « {assignment.title} » dans le groupe {obj.group.name}.',
                        link='/my-assignments',
                    )
            return JsonResponse({'id': None, 'saved': True, 'created': len(group_students)})
    model_admin.save_model(request, obj, form, instance is not None)
    form.save_m2m()
    return JsonResponse({'id': str(obj.pk), 'saved': True})