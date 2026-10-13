import logging
from django.conf import settings
from django.shortcuts import get_object_or_404, render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError as SerializerValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics
from django.contrib.flatpages.models import FlatPage
from . serializers import TeacherSerializer,TeacherStudentChatSerializer,FlatPageSerializer,FaqSerializer,StudyMaterialSerializer,AttempQuizSerializer,QuestionSerializer,CourseQuizSerializer,QuizSerializer,StudentDashboardSerializer,StudentFavoriteCourseSerializer,StudentAssignmentSerializer,CategorySerializer,CourseSerializer,ChapterSerializer,StudentSerializer,StudentCourseEnrollSerializer,CourseRatingSerializer,TeacherDashboardSerializer,NotificationSerializer,GroupMessageSerializer
from rest_framework import permissions
from django.db.models import F, Q
from . import models
from .ai_services import extract_material_text, summarize_material
from rest_framework.pagination import PageNumberPagination

logger = logging.getLogger(__name__)

class StandardResultSetPagination(PageNumberPagination):
    page_size=8
    page_size_query_param='page_size'
    max_page_size=1

class TeacherList(generics.ListCreateAPIView):
    queryset=models.Teacher.objects.all()
    serializer_class=TeacherSerializer

    def perform_create(self, serializer):
        serializer.save(is_active=False, is_approved=False)

    def get_queryset(self):
        if 'popular' in self.request.GET:
            sql="SELECT *,COUNT(c.id) as total_course FROM main_teacher as t INNER JOIN main_course as c ON c.teacher_id=t.id GROUP BY t.id ORDER BY total_course desc"  
            return models.Teacher.objects.raw(sql)
        return super().get_queryset()

class TeacherDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.Teacher.objects.all()
    serializer_class=TeacherSerializer
    
@csrf_exempt
def teacher_login(request):
    if request.method != 'POST':
        return JsonResponse({'bool': False}, status=405)
    email=request.POST.get('email', '').strip()
    password=request.POST.get('password', '')
    if not email or not password:
        return JsonResponse({'bool': False}, status=400)
    try:
        teacherData=models.Teacher.objects.get(email=email,password=password)
    except models.Teacher.DoesNotExist:
        teacherData=None
    if teacherData and not teacherData.is_approved:
        return JsonResponse({'bool': False, 'status': 'pending_approval'})
    if teacherData and teacherData.is_active:
        return JsonResponse({'bool':True,'teacher_id':teacherData.id})
    else:
        return JsonResponse({'bool':False})

class StudentDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.Student.objects.all()
    serializer_class=StudentSerializer

class CategoryList(generics.ListCreateAPIView):
    queryset=models.CourseCategory.objects.all()
    serializer_class=CategorySerializer

class TeacherDashboard(generics.RetrieveAPIView):
    queryset=models.Teacher.objects.all()
    serializer_class=TeacherDashboardSerializer

class CourseList(generics.ListCreateAPIView):
    queryset=models.Course.objects.all()
    serializer_class=CourseSerializer
    pagination_class=StandardResultSetPagination

    def get_queryset(self):
        qs=super().get_queryset()
        if 'result' in self.request.GET:
            limit=int(self.request.GET['result'])
        if 'popular' in self.request.GET:
            qs=qs.order_by('-course_views', '-id')
        elif 'result' in self.request.GET:
            qs=qs.order_by('-id')[:limit]

        if 'category' in self.request.GET :
            category=self.request.GET['category']
            category=models.CourseCategory.objects.filter(id=category).first()
            qs=models.Course.objects.filter(category=category)

        if 'skill_name' in self.request.GET and 'teacher' in self.request.GET:
            skill_name=self.request.GET['skill_name']
            teacher=self.request.GET['teacher']
            teacher=models.Teacher.objects.filter(id=teacher).first()
            qs=models.Course.objects.filter(techs__icontains=skill_name,teacher=teacher)

        if 'searchstring' in self.kwargs:
            search=self.kwargs['searchstring']
            qs=models.Course.objects.filter(Q(title__icontains=search)|Q(description__icontains=search))
        
        return qs

class TeacherCourseList(generics.ListAPIView):
    serializer_class=CourseSerializer

    def get_queryset(self):
        teacher_id=self.kwargs['teacher_id']
        teacher=models.Teacher.objects.get(pk=teacher_id)
        return models.Course.objects.filter(teacher=teacher)

class CourseDetailView(generics.RetrieveAPIView):
    queryset=models.Course.objects.all()
    serializer_class=CourseSerializer

class TeacherCourseDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.Course.objects.all()
    serializer_class=CourseSerializer

class ChapterList(generics.ListCreateAPIView):
    queryset=models.Chapter.objects.all()
    serializer_class=ChapterSerializer

class CourseChapterList(generics.ListCreateAPIView):
    serializer_class=ChapterSerializer

    def get_queryset(self):
        course_id=self.kwargs['course_id']
        course=models.Course.objects.get(pk=course_id)
        return models.Chapter.objects.filter(course=course)

class ChapterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.Chapter.objects.all()
    serializer_class=ChapterSerializer

class StudentList(generics.ListCreateAPIView):
    queryset=models.Student.objects.all()
    serializer_class=StudentSerializer

    def perform_create(self, serializer):
        serializer.save(is_active=False, is_approved=False)

class StudentDashboard(generics.RetrieveAPIView):
    queryset=models.Student.objects.all()
    serializer_class=StudentDashboardSerializer

@csrf_exempt
def student_login(request):
    if request.method != 'POST':
        return JsonResponse({'bool': False}, status=405)
    email=request.POST.get('email', '').strip()
    password=request.POST.get('password', '')
    if not email or not password:
        return JsonResponse({'bool': False}, status=400)
    try:
        studentData=models.Student.objects.get(email=email,password=password)
    except models.Student.DoesNotExist:
        studentData=None
    if studentData and not studentData.is_approved:
        return JsonResponse({'bool': False, 'status': 'pending_approval'})
    if studentData and studentData.is_active:
        return JsonResponse({'bool':True,'student_id':studentData.id})
    else:
        return JsonResponse({'bool':False})

class StudentEnrollCourseList(generics.ListCreateAPIView):
    queryset=models.StudentCourseEnrollment.objects.all()
    serializer_class=StudentCourseEnrollSerializer
    http_method_names = ['post', 'options']

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enrollment, created = models.StudentCourseEnrollment.objects.get_or_create(
            course=serializer.validated_data['course'],
            student=serializer.validated_data['student'],
            defaults={'status': models.StudentCourseEnrollment.STATUS_PENDING},
        )
        was_rejected = not created and enrollment.status == models.StudentCourseEnrollment.STATUS_REJECTED
        if was_rejected:
            enrollment.status = models.StudentCourseEnrollment.STATUS_PENDING
            enrollment.save(update_fields=['status'])
        if created or was_rejected:
            models.Notification.objects.create(
                teacher=enrollment.course.teacher,
                subject='Nouvelle demande d’inscription',
                message=f'{enrollment.student.fullname} demande l’accès à {enrollment.course.title}.',
                link=f'/my-users?request_id={enrollment.id}',
            )
        response_serializer = self.get_serializer(enrollment)
        return Response(response_serializer.data, status=201 if created else 200)


@csrf_exempt
def approve_enrollment(request, teacher_id, enrollment_id):
    if request.method != 'POST':
        return JsonResponse({'detail': 'POST required.'}, status=405)
    enrollment = get_object_or_404(
        models.StudentCourseEnrollment,
        pk=enrollment_id,
        course__teacher_id=teacher_id,
    )
    if enrollment.status != models.StudentCourseEnrollment.STATUS_PENDING:
        return JsonResponse({'status': enrollment.status}, status=200)
    enrollment.status = models.StudentCourseEnrollment.STATUS_APPROVED
    enrollment.save(update_fields=['status'])
    models.Notification.objects.create(
        student=enrollment.student,
        subject='Demande approuvée',
        message=f'Votre accès au cours {enrollment.course.title} est approuvé.',
        link=f'/detail/{enrollment.course_id}',
    )
    return JsonResponse({'id': enrollment.id, 'status': enrollment.status})


@csrf_exempt
def approve_all_enrollments(request, teacher_id):
    if request.method != 'POST':
        return JsonResponse({'detail': 'POST required.'}, status=405)
    with transaction.atomic():
        pending_enrollments = list(models.StudentCourseEnrollment.objects.filter(
            course__teacher_id=teacher_id,
            status=models.StudentCourseEnrollment.STATUS_PENDING,
        ).select_related('student', 'course'))
        for enrollment in pending_enrollments:
            models.Notification.objects.create(
                student=enrollment.student,
                subject='Demande approuvée',
                message=f'Votre accès au cours {enrollment.course.title} est approuvé.',
                link=f'/detail/{enrollment.course_id}',
            )
        approved_count = models.StudentCourseEnrollment.objects.filter(
            pk__in=[enrollment.pk for enrollment in pending_enrollments],
        ).update(status=models.StudentCourseEnrollment.STATUS_APPROVED)
    return JsonResponse({'approved_count': approved_count})


class NotificationList(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        recipient_type = self.kwargs['recipient_type']
        recipient_id = self.kwargs['recipient_id']
        if recipient_type == 'teacher':
            return models.Notification.objects.filter(teacher_id=recipient_id)[:30]
        if recipient_type == 'student':
            return models.Notification.objects.filter(student_id=recipient_id)[:30]
        return models.Notification.objects.none()


class NotificationReadView(APIView):
    def post(self, request, recipient_type, recipient_id, notification_id):
        recipient_field = {'teacher': 'teacher_id', 'student': 'student_id'}.get(recipient_type)
        if not recipient_field:
            return Response({'detail': 'Invalid recipient type.'}, status=400)
        notification = get_object_or_404(
            models.Notification,
            pk=notification_id,
            **{recipient_field: recipient_id},
        )
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response({'is_read': notification.is_read})

def fetch_enroll_status(request,student_id,course_id):
    enrollment = models.StudentCourseEnrollment.objects.filter(
        student_id=student_id, course_id=course_id).first()
    return JsonResponse({
        'bool': bool(enrollment and enrollment.status == models.StudentCourseEnrollment.STATUS_APPROVED),
        'status': enrollment.status if enrollment else None,
    })

class EnrolledStuentList(generics.ListAPIView):
    queryset=models.StudentCourseEnrollment.objects.all()
    serializer_class=StudentCourseEnrollSerializer

    def get_queryset(self):
        if 'course_id' in self.kwargs:
            course_id=self.kwargs['course_id']
            course=models.Course.objects.get(pk=course_id)
            return models.StudentCourseEnrollment.objects.filter(
                course=course, status=models.StudentCourseEnrollment.STATUS_APPROVED)
        elif 'teacher_id' in self.kwargs:
            teacher_id=self.kwargs['teacher_id']
            teacher=models.Teacher.objects.get(pk=teacher_id)
            return models.StudentCourseEnrollment.objects.filter(
                course__teacher=teacher).exclude(
                    status=models.StudentCourseEnrollment.STATUS_REJECTED).distinct()
        elif 'student_id' in self.kwargs:
            student_id=self.kwargs['student_id']
            student=models.Student.objects.get(pk=student_id)
            return models.StudentCourseEnrollment.objects.filter(
                student=student, status=models.StudentCourseEnrollment.STATUS_APPROVED).distinct()
        elif 'studentId' in self.kwargs:
            student_id=self.kwargs['student_id']
            student=models.Student.objects.get(pk=student_id)
            print(student.interseted_categories)
            queries=[Q(techs__iendwith=value) for value in student.interseted_categories]
            query=queries.pop()
            for item in queries:
                query |= item
            qs=models.Course.objects.filter(query)
        return qs

class CourseRatingList(generics.ListCreateAPIView):
    queryset=models.CourseRating.objects.all()
    serializer_class=CourseRatingSerializer
    pagination_class=StandardResultSetPagination

    def get_queryset(self):
        if 'popular' in self.request.GET:
            sql="SELECT *, AVG(cr.rating) as avg_rating FROM main_courserating as cr INNER JOIN main_course as c ON cr.course_id=c.id GROUP BY c.id ORDER BY avg_rating desc LIMIT 3"
            return models.CourseRating.objects.raw(sql)
        if 'all' in self.request.GET:
            sql="SELECT *, AVG(cr.rating) as avg_rating FROM main_courserating as cr INNER JOIN main_course as c ON cr.course_id=c.id GROUP BY c.id ORDER BY avg_rating desc"
            return models.CourseRating.objects.raw(sql)
        return models.CourseRating.objects.filter(course__isnull=False).order_by('-rating')

def fetch_rating_status(request,student_id,course_id):
    student=models.Student.objects.filter(id=student_id).first()
    course=models.Course.objects.filter(id=course_id).first()
    ratingStatus=models.CourseRating.objects.filter(course=course,student=student).count()
    if ratingStatus:
        return JsonResponse({'bool':True})
    else:
        return JsonResponse({'bool':False})

@csrf_exempt
def teacher_change_password(request,teacher_id):
    password=request.POST['password']
    try:
        teacherData=models.Teacher.objects.get(id=teacher_id)
    except models.Teacher.DoesNotExist:
        teacherData=None
    if teacherData:
        models.Teacher.objects.filter(id=teacher_id).update(password=password)
        return JsonResponse({'bool':True})
    else:
        return JsonResponse({'bool':False})

class StudentFavoriteCourseList(generics.ListCreateAPIView):
    queryset=models.StudentFavoriteCourse.objects.all()
    serializer_class=StudentFavoriteCourseSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        favorite, created = models.StudentFavoriteCourse.objects.get_or_create(
            student=serializer.validated_data['student'],
            course=serializer.validated_data['course'],
            defaults={'status': True},
        )
        if not favorite.status:
            favorite.status = True
            favorite.save(update_fields=['status'])
        response_serializer = self.get_serializer(favorite)
        return Response(response_serializer.data, status=201 if created else 200)

    def get_queryset(self):
        if 'student_id' in self.kwargs:
            student_id=self.kwargs['student_id']
            student=models.Student.objects.get(pk=student_id)
            return models.StudentFavoriteCourse.objects.filter(student=student).distinct()

def fetch_favorite_status(request,student_id,course_id):
    is_favorite=models.StudentFavoriteCourse.objects.filter(
        student_id=student_id,course_id=course_id,status=True).exists()
    return JsonResponse({'bool':is_favorite})

def remove_favorite_course(request,course_id,student_id):
    student=models.Student.objects.filter(id=student_id).first()
    course=models.Course.objects.filter(id=course_id).first()
    favoriteStatus=models.StudentFavoriteCourse.objects.filter(course=course,student=student).delete()
    if favoriteStatus:
        return JsonResponse({'bool':True})
    else:
        return JsonResponse({'bool':False})

class AssignmentList(generics.ListCreateAPIView):
    queryset=models.StudentAssignment.objects.all()
    serializer_class=StudentAssignmentSerializer

    def get_queryset(self):
        student_id=self.kwargs['student_id']
        teacher_id=self.kwargs['teacher_id']
        student=models.Student.objects.get(pk=student_id)
        teacher=models.Teacher.objects.get(pk=teacher_id)
        return models.StudentAssignment.objects.filter(student=student,teacher=teacher)

    def perform_create(self, serializer):
        student = get_object_or_404(models.Student, pk=self.kwargs['student_id'])
        teacher = get_object_or_404(models.Teacher, pk=self.kwargs['teacher_id'])
        assignment = serializer.save(student=student, teacher=teacher, group=None)
        models.Notification.objects.create(
            student=student,
            subject='Nouveau devoir reçu',
            message=f'{teacher.full_name} vous a envoyé le devoir « {assignment.title} ».',
            link='/my-assignments',
        )

class MyAssignmentList(generics.ListCreateAPIView):
    queryset=models.StudentAssignment.objects.all()
    serializer_class=StudentAssignmentSerializer

    def get_queryset(self):
        student_id=self.kwargs['student_id']
        student=models.Student.objects.get(pk=student_id)
        return models.StudentAssignment.objects.filter(student=student)

class UpdateAssignmentList(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.StudentAssignment.objects.all()
    serializer_class=StudentAssignmentSerializer

@csrf_exempt
def student_change_password(request,student_id):
    password=request.POST['password']
    try:
        studentData=models.Student.objects.get(id=student_id)
    except models.Student.DoesNotExist:
        studentData=None
    if studentData:
        models.Student.objects.filter(id=student_id).update(password=password)
        return JsonResponse({'bool':True})
    else:
        return JsonResponse({'bool':False})

class Quizlist(generics.ListCreateAPIView):
    queryset=models.Quiz.objects.all()
    serializer_class=QuizSerializer

class TeacherQuizList(generics.ListCreateAPIView):
    serializer_class=QuizSerializer

    def get_queryset(self):
        teacher_id=self.kwargs['teacher_id']
        teacher=models.Teacher.objects.get(pk=teacher_id)
        return models.Quiz.objects.filter(teacher=teacher)

class TeacherQuizDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.Quiz.objects.all()
    serializer_class=QuizSerializer

class QuizDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset=models.Quiz.objects.all()
    serializer_class=QuizSerializer
 
class CourseQuizList(generics.ListCreateAPIView):
    queryset=models.CourseQuiz.objects.all()
    serializer_class=CourseQuizSerializer

    def get_queryset(self):
        if 'course_id' in self.kwargs:
            course_id=self.kwargs['course_id']
            course=models.Course.objects.get(pk=course_id)
            return models.CourseQuiz.objects.filter(course=course)

def fetch_quiz_assign_status(request,quiz_id,course_id):
    quiz=models.Quiz.objects.filter(id=quiz_id).first()
    course=models.Course.objects.filter(id=course_id).first()
    assignStatus=models.CourseQuiz.objects.filter(course=course,quiz=quiz).count()
    if assignStatus:
        return JsonResponse({'bool':True})
    else:
        return JsonResponse({'bool':False})

 
class QuizQuestionList(generics.ListCreateAPIView):
    serializer_class=QuestionSerializer

    def get_queryset(self):
            quiz_id=self.kwargs['quiz_id']
            quiz=models.Quiz.objects.get(pk=quiz_id)
            if 'limit' in self.kwargs:
                return models.QuizQuestions.objects.filter(quiz=quiz).order_by('id')[:1]
            elif 'question_id' in self.kwargs:
                current_question=self.kwargs['question_id']
                return models.QuizQuestions.objects.filter(quiz=quiz,id__gt=current_question).order_by('id')[:1]
            else:
                return models.QuizQuestions.objects.filter(quiz=quiz)

class AttempQuizList(generics.ListCreateAPIView):
    queryset=models.AttemptQuiz.objects.all()
    serializer_class=AttempQuizSerializer

    def get_queryset(self):
        if  'quiz_id' in self.kwargs:
            quiz_id=self.kwargs['quiz_id']
            quiz=models.Quiz.objects.get(pk=quiz_id)
            return models.AttemptQuiz.objects.raw(f'SELECT * FROM main_attemptquiz WHERE quiz_id={int(quiz_id)} GROUP by student_id')

def fetch_quiz_attempt_status(request,quiz_id,student_id):
    quiz=models.Quiz.objects.filter(id=quiz_id).first()
    student=models.Student.objects.filter(id=student_id).first()
    attemptStatus=models.AttemptQuiz.objects.filter(student=student,question__quiz=quiz).count()
    print(models.AttemptQuiz.objects.filter(student=student,question__quiz=quiz).query)
    if attemptStatus > 0:
        return JsonResponse({'bool':True})
    else:
        return JsonResponse({'bool':False})

def fetch_quiz_result(request,quiz_id,student_id):
    quiz=models.Quiz.objects.filter(id=quiz_id).first()
    student=models.Student.objects.filter(id=student_id).first()
    total_questions=models.QuizQuestions.objects.filter(quiz=quiz).count()
    total_attempted_questions=models.AttemptQuiz.objects.filter(quiz=quiz,student=student).values('student').count()
    attempted_questions=models.AttemptQuiz.objects.filter(quiz=quiz,student=student)

    total_correct_questions=0
    for attempt in attempted_questions:
        if attempt.right_ans == attempt.question.right_ans:
            total_correct_questions+=1

    return JsonResponse({'total_questions':total_questions, 'total_attempted_questions':total_attempted_questions,'total_correct_questions':total_correct_questions})

VIDEO_FILE_EXTENSIONS = (
    '.3gp', '.avi', '.flv', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg',
    '.mpg', '.ogv', '.webm', '.wmv',
)


class StudyMaterialList(generics.ListCreateAPIView):
    serializer_class=StudyMaterialSerializer

    def get_queryset(self):
        course_id=self.kwargs['course_id']
        course=models.Course.objects.get(pk=course_id)
        queryset = models.StudyMaterial.objects.filter(course=course)
        if 'student_id' in self.kwargs:
            is_approved = models.StudentCourseEnrollment.objects.filter(
                course=course,
                student_id=self.kwargs['student_id'],
                status=models.StudentCourseEnrollment.STATUS_APPROVED,
            ).exists()
            if not is_approved:
                raise PermissionDenied('Teacher approval is required to access course materials.')
            for extension in VIDEO_FILE_EXTENSIONS:
                queryset = queryset.exclude(upload__iendswith=extension)
            return queryset

        teacher_id = self.kwargs.get('teacher_id')
        if not teacher_id or course.teacher_id != teacher_id:
            raise PermissionDenied('Only the course teacher can manage these materials.')
        return queryset

    def perform_create(self, serializer):
        course = serializer.validated_data['course']
        teacher_id = self.kwargs.get('teacher_id')
        if not teacher_id or course.teacher_id != teacher_id:
            raise PermissionDenied('Only the course teacher can add materials.')
        material = serializer.save()
        material.extracted_text = extract_material_text(material)
        material.save(update_fields=['extracted_text'])
        if settings.OPENAI_API_KEY and material.extracted_text:
            try:
                summarize_material(material)
            except Exception:
                logger.exception('Could not summarize uploaded course material')

class StudyMaterialView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class=StudyMaterialSerializer

    def get_queryset(self):
        teacher_id = self.request.query_params.get('teacher_id')
        if not teacher_id:
            return models.StudyMaterial.objects.none()
        return models.StudyMaterial.objects.filter(course__teacher_id=teacher_id)

    def perform_update(self, serializer):
        source_fields = {'title', 'description', 'upload', 'remarks'}
        source_changed = source_fields.intersection(serializer.validated_data)
        material = serializer.save()
        if not source_changed:
            return

        material.extracted_text = extract_material_text(material)
        material.ai_summary = ''
        material.save(update_fields=['extracted_text', 'ai_summary'])
        if settings.OPENAI_API_KEY and material.extracted_text:
            try:
                summarize_material(material)
            except Exception:
                logger.exception('Could not summarize updated course material')

def update_view(request,course_id):
    course=get_object_or_404(models.Course,pk=course_id)
    student_id=request.GET.get('student_id')
    if not student_id:
        return JsonResponse({'detail':'A student identity is required to count a course view.'}, status=400)
    get_object_or_404(models.Student,pk=student_id)
    _, created=models.CourseView.objects.get_or_create(
        course=course,student_id=student_id)
    if created:
        models.Course.objects.filter(pk=course_id).update(course_views=F('course_views')+1)
        course.refresh_from_db(fields=['course_views'])
    return JsonResponse({'views':course.course_views})

class FaqList(generics.ListAPIView):
    queryset=models.Faq.objects.all()
    serializer_class=FaqSerializer

class FlatPagesList(generics.ListAPIView):
    queryset=FlatPage.objects.all()
    serializer_class=FlatPageSerializer

class FlatPagesDetail(generics.ListAPIView):
    queryset=FlatPage.objects.all()
    serializer_class=FlatPageSerializer

@csrf_exempt
def ChatBot(request,teacher_id,student_id):
    teacher=models.Teacher.objects.get(id=teacher_id)
    student=models.Student.objects.get(id=student_id)
    msg_to=request.POST.get('msg_to')
    msg_from=request.POST.get('msg_from')
    msgRes=models.TeacherStudentChat.objects.create(
        teacher=teacher,
        student=student,
        msg_to=msg_to,
        msg_from=msg_from
    )

    if msgRes:
        if msg_from == 'teacher':
            models.Notification.objects.create(
                student=student,
                subject=f'Nouveau message de {teacher.full_name}',
                message=(msg_to or '')[:300],
                link=f'/my-teachers?teacher_id={teacher.id}',
            )
        else:
            models.Notification.objects.create(
                teacher=teacher,
                subject=f'Nouveau message de {student.fullname}',
                message=(msg_to or '')[:300],
                link=f'/my-users?student_id={student.id}',
            )
        return JsonResponse({'bool':True,'msg':'Message sended'})
    else:
        return JsonResponse({'bool':False,'msg':'Message failed'})

class MessageList(generics.ListAPIView):
    queryset=models.TeacherStudentChat.objects.all()
    serializer_class=TeacherStudentChatSerializer

    def get_queryset(self):
        teacher_id=self.kwargs['teacher_id']
        student_id=self.kwargs['student_id']
        teacher=models.Teacher.objects.get(pk=teacher_id)
        student=models.Student.objects.get(pk=student_id)
        messages = models.TeacherStudentChat.objects.filter(
            teacher=teacher, student=student).exclude(msg_to='')
        viewer = self.request.query_params.get('viewer')
        if viewer == 'teacher':
            messages.filter(msg_from='student', is_read=False).update(is_read=True)
        elif viewer == 'student':
            messages.filter(msg_from='teacher', is_read=False).update(is_read=True)
        return messages


class MessageDetail(APIView):
    def get_owned_message(self, message_id, sender_type):
        if sender_type not in ('teacher', 'student'):
            raise PermissionDenied('Invalid sender type.')
        message = get_object_or_404(models.TeacherStudentChat, pk=message_id)
        if message.msg_from != sender_type:
            raise PermissionDenied('You can only change your own messages.')
        return message

    def patch(self, request, message_id, sender_type):
        message = self.get_owned_message(message_id, sender_type)
        text = request.data.get('msg_to', '').strip()
        if not text:
            return Response({'msg_to': ['Message cannot be empty.']}, status=400)
        message.msg_to = text
        message.edited_at = timezone.now()
        message.save(update_fields=['msg_to', 'edited_at'])
        return Response(TeacherStudentChatSerializer(message, context={'request': request}).data)

    def delete(self, request, message_id, sender_type):
        message = self.get_owned_message(message_id, sender_type)
        message.delete()
        return Response(status=204)

def _group_member(group, params):
    student_id = params.get('student_id')
    teacher_id = params.get('teacher_id')
    if bool(student_id) == bool(teacher_id):
        raise PermissionDenied('Indiquez un seul compte membre du groupe.')
    if student_id:
        student = get_object_or_404(models.Student, pk=student_id, is_active=True, is_approved=True)
        membership = get_object_or_404(models.GroupMembership, group=group, student=student)
        return 'student', student, membership
    teacher = get_object_or_404(models.Teacher, pk=teacher_id, is_active=True, is_approved=True)
    membership = get_object_or_404(models.GroupMembership, group=group, teacher=teacher)
    return 'teacher', teacher, membership


class GroupList(APIView):
    def get(self, request):
        student_id = request.query_params.get('student_id')
        teacher_id = request.query_params.get('teacher_id')
        if bool(student_id) == bool(teacher_id):
            raise PermissionDenied('Indiquez votre identifiant étudiant ou enseignant.')
        if student_id:
            get_object_or_404(models.Student, pk=student_id, is_active=True, is_approved=True)
            groups = models.LearningGroup.objects.filter(memberships__student_id=student_id)
        else:
            get_object_or_404(models.Teacher, pk=teacher_id, is_active=True, is_approved=True)
            groups = models.LearningGroup.objects.filter(memberships__teacher_id=teacher_id)
        return Response([{
            'id': group.pk,
            'name': group.name,
            'cover_image': request.build_absolute_uri(group.cover_image.url) if group.cover_image else '',
            'member_count': group.memberships.count(),
        } for group in groups.distinct()])


class GroupMessageListCreate(APIView):
    def get(self, request, group_id):
        group = get_object_or_404(models.LearningGroup, pk=group_id)
        _group_member(group, request.query_params)
        messages = group.messages.select_related('student', 'teacher').order_by('-created_at')[:100]
        messages = reversed(list(messages))
        return Response(GroupMessageSerializer(messages, many=True).data)

    def post(self, request, group_id):
        group = get_object_or_404(models.LearningGroup, pk=group_id)
        sender_type, sender, _ = _group_member(group, request.data)
        message_text = str(request.data.get('message') or '').strip()
        if not message_text or len(message_text) > 5000:
            return Response({'detail': 'Le message doit contenir entre 1 et 5 000 caractères.'}, status=400)

        message_fields = {'group': group, 'message': message_text}
        if sender_type == 'student':
            message_fields['student'] = sender
            recipient_memberships = group.memberships.exclude(student=sender)
            link = f'/groups/{group.pk}'
        else:
            message_fields['teacher'] = sender
            recipient_memberships = group.memberships.exclude(teacher=sender)
            link = f'/groups/{group.pk}'
        group_message = models.GroupMessage.objects.create(**message_fields)
        notification_rows = []
        for membership in recipient_memberships.select_related('student', 'teacher'):
            notification = models.Notification(
                subject=f'Nouveau message dans {group.name}',
                message=f'{group_message.sender_name} : {message_text[:250]}',
                link=link,
            )
            if membership.student_id:
                notification.student = membership.student
            else:
                notification.teacher = membership.teacher
            notification_rows.append(notification)
        models.Notification.objects.bulk_create(notification_rows)
        return Response(GroupMessageSerializer(group_message).data, status=201)


class GroupAssignmentCreate(APIView):
    def post(self, request, group_id):
        group = get_object_or_404(models.LearningGroup, pk=group_id)
        sender_type, teacher, _ = _group_member(group, request.data)
        if sender_type != 'teacher':
            raise PermissionDenied('Seul un enseignant membre du groupe peut envoyer un devoir.')
        title = str(request.data.get('title') or '').strip()
        detail = str(request.data.get('detail') or '').strip()
        if not title or not detail:
            return Response({'detail': 'Le titre et les consignes du devoir sont obligatoires.'}, status=400)
        try:
            detail = StudentAssignmentSerializer().validate_detail(detail)
        except SerializerValidationError as error:
            return Response({'detail': str(error.detail[0])}, status=400)
        students = models.Student.objects.filter(
            group_memberships__group=group,
            is_active=True,
            is_approved=True,
        ).distinct()
        if not students.exists():
            return Response({'detail': 'Aucun étudiant actif ne fait partie de ce groupe.'}, status=400)
        assignments = [
            models.StudentAssignment(
                teacher=teacher,
                student=student,
                group=group,
                title=title,
                detail=detail,
            )
            for student in students
        ]
        with transaction.atomic():
            models.StudentAssignment.objects.bulk_create(assignments)
            models.Notification.objects.bulk_create([
                models.Notification(
                    student=student,
                    subject='Nouveau devoir reçu',
                    message=f'{teacher.full_name} vous a envoyé le devoir « {title} » dans le groupe {group.name}.',
                    link='/my-assignments',
                )
                for student in students
            ])
        return Response({'created': len(assignments), 'group': group.name}, status=201)


class MyTeacherList(generics.ListAPIView):
    queryset=models.Course.objects.all()
    serializer_class=CourseSerializer

    def get_queryset(self):
        if 'student_id' in self.kwargs:
            student_id=self.kwargs['student_id']
            sql=f"SELECT * FROM main_course as c,main_studentcourseenrollment as e,main_teacher as t WHERE c.teacher_id=t.id AND e.course_id=c.id AND e.student_id={student_id} GROUP BY c.teacher_id"
            qs=models.Course.objects.raw(sql)
            print(qs)
            return qs
