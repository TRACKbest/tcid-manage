from rest_framework import serializers
from django.db.models import Count
import bleach
from . import models
from django.contrib.flatpages.models import FlatPage
from .accounts import PasswordHashingMixin
from .payments import free_chapter_ids, has_course_access


RICH_TEXT_TAGS = {
    'a', 'blockquote', 'br', 'em', 'h1', 'h2', 'h3', 'li',
    'ol', 'p', 's', 'span', 'strong', 'u', 'ul', 'pre', 'code',
}
RICH_TEXT_ATTRIBUTES = {
    'a': ['href', 'rel', 'target'],
    'h1': ['class'],
    'h2': ['class'],
    'h3': ['class'],
    'li': ['class', 'data-list'],
    'ol': ['class'],
    'p': ['class'],
    'pre': ['class', 'spellcheck'],
    'span': ['class'],
    'ul': ['class'],
}
VIDEO_EXTENSIONS = {
    '3gp', 'avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4',
    'mpeg', 'mpg', 'ogv', 'webm', 'wmv',
}


def clean_rich_text(value):
    return bleach.clean(
        value or '',
        tags=RICH_TEXT_TAGS,
        attributes=RICH_TEXT_ATTRIBUTES,
        protocols={'http', 'https', 'mailto'},
        strip=True,
    )


def strip_secrets(data):
    """Remove password hashes that nested (depth=2) representations would expose."""
    if isinstance(data, dict):
        return {key: strip_secrets(value) for key, value in data.items() if key != 'password'}
    if isinstance(data, list):
        return [strip_secrets(item) for item in data]
    return data


class SecretStrippingMixin:
    def to_representation(self, instance):
        return strip_secrets(super().to_representation(instance))


def reject_video_upload(value, message):
    extension = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
    content_type = getattr(value, 'content_type', '') or ''
    if extension in VIDEO_EXTENSIONS or content_type.startswith('video/'):
        raise serializers.ValidationError(message)
    return value


class TeacherSerializer(PasswordHashingMixin, SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.Teacher
        fields=['id','full_name','email','password','is_active','is_approved','qualification','mobile_no','skills','profile_img','teacher_courses','skill_list','total_teacher_course','face_url','insta_url','twit_url','web_url','you_url']
        extra_kwargs = {
            'is_active': {'read_only': True},
            'is_approved': {'read_only': True},
            'password': {'write_only': True, 'required': False, 'allow_blank': True},
            'skills': {'required': False, 'allow_blank': True},
            'face_url': {'required': False, 'allow_blank': True, 'allow_null': True},
            'insta_url': {'required': False, 'allow_blank': True, 'allow_null': True},
            'twit_url': {'required': False, 'allow_blank': True, 'allow_null': True},
            'web_url': {'required': False, 'allow_blank': True, 'allow_null': True},
            'you_url': {'required': False, 'allow_blank': True, 'allow_null': True},
        }

    def to_internal_value(self, data):
        data = data.copy()
        for field_name in ('face_url', 'insta_url', 'twit_url', 'web_url', 'you_url'):
            value = data.get(field_name)
            if isinstance(value, str):
                value = value.strip()
                if value and not value.lower().startswith(('http://', 'https://')):
                    value = f'https://{value}'
                data[field_name] = value
        return super().to_internal_value(data)

    def __init__(self, *args, **kwargs):
            super(TeacherSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class CategorySerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.CourseCategory
        fields=['id','title','description','total_courses']
    def __init__(self, *args, **kwargs):
            super(CategorySerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class CourseSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    course_chapters = serializers.SerializerMethodField()
    is_paid = serializers.BooleanField(read_only=True)

    class Meta:
        model=models.Course
        fields=['id','category','teacher','title','description','featured_img','techs','price','is_paid','course_chapters','total_chapters','related_videos','teach_list','total_enrolled_students','course_rating','course_views']
        read_only_fields=['course_views']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'price': {'required': False},
        }

    def validate_price(self, value):
        if value > 10_000_000:
            raise serializers.ValidationError('Le prix ne peut pas dépasser 10 000 000 Ar.')
        return value

    def validate_description(self, value):
        return clean_rich_text(value)

    def get_course_chapters(self, course):
        free_ids = free_chapter_ids(course)
        student_id = self.context.get('student_id')
        unlocked = has_course_access(student_id, course) if student_id else False
        return [
            {
                'id': chapter.id,
                'title': chapter.title,
                'position': index + 1,
                'is_free': chapter.id in free_ids,
                'is_locked': not unlocked and chapter.id not in free_ids,
                'has_video': bool(chapter.video),
                'documents_count': chapter.documents.count(),
            }
            for index, chapter in enumerate(course.ordered_chapters())
        ]

    def __init__(self, *args, **kwargs):
            super(CourseSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class ChapterDocumentSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.ChapterDocument
        fields=['id','chapter','title','description','upload','position','created_at']
        read_only_fields=['chapter','created_at']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'position': {'required': False},
        }

    def validate_description(self, value):
        return clean_rich_text(value)

    def validate_upload(self, value):
        return reject_video_upload(value, 'Ajoutez la vidéo dans le chapitre ; les documents acceptent PDF, Word, images, archives…')


class ChapterSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    documents = serializers.SerializerMethodField()
    is_free = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model=models.Chapter
        fields=['id','course','title','description','video','remarks','position','is_free_preview','is_free','is_locked','documents']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True, 'allow_null': True},
            'position': {'required': False},
            'video': {'required': False, 'allow_null': True},
        }

    def validate_description(self, value):
        return clean_rich_text(value)

    def _free_ids(self, chapter):
        cache = self.context.setdefault('_free_chapter_ids', {})
        if chapter.course_id not in cache:
            cache[chapter.course_id] = free_chapter_ids(chapter.course) if chapter.course_id else set()
        return cache[chapter.course_id]

    def _has_full_access(self, chapter):
        if self.context.get('is_course_teacher'):
            return True
        cache = self.context.setdefault('_course_access', {})
        if chapter.course_id not in cache:
            student_id = self.context.get('student_id')
            cache[chapter.course_id] = bool(student_id) and has_course_access(student_id, chapter.course)
        return cache[chapter.course_id]

    def get_is_free(self, chapter):
        return chapter.id in self._free_ids(chapter)

    def get_is_locked(self, chapter):
        return not self._has_full_access(chapter) and not self.get_is_free(chapter)

    def get_documents(self, chapter):
        if self.get_is_locked(chapter):
            return []
        return ChapterDocumentSerializer(chapter.documents.all(), many=True, context=self.context).data

    def to_representation(self, chapter):
        data = super().to_representation(chapter)
        if data['is_locked']:
            data['video'] = None
            data['remarks'] = None
        return data

class StudentSerializer(PasswordHashingMixin, SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.Student
        fields=['id','fullname','email','password','is_active','is_approved','username','interseted_categories','profile_img']
        extra_kwargs = {
            'is_active': {'read_only': True},
            'is_approved': {'read_only': True},
            'password': {'write_only': True, 'required': False, 'allow_blank': True},
        }
    def __init__(self, *args, **kwargs):
            super(StudentSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class StudentCourseEnrollSerializer(SecretStrippingMixin, serializers.ModelSerializer):        
        class Meta:
            model=models.StudentCourseEnrollment
            fields='__all__'
        def __init__(self, *args, **kwargs):
            super(StudentCourseEnrollSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2
            

class StudentFavoriteCourseSerializer(SecretStrippingMixin, serializers.ModelSerializer):
        class Meta:
            model=models.StudentFavoriteCourse
            fields=['id','course','student','status']
            validators=[]
        def __init__(self, *args, **kwargs):
            super(StudentFavoriteCourseSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class CourseRatingSerializer(SecretStrippingMixin, serializers.ModelSerializer):
        class Meta:
            model=models.CourseRating
            fields=['id','course','student','rating','reviews','review_time']
        def __init__(self, *args, **kwargs):
            super(CourseRatingSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class TeacherDashboardSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.Teacher
        fields=['total_teacher_course','total_teacher_chapters','total_teacher_students']

class StudentAssignmentSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.StudentAssignment
        fields=['id','teacher','student','group','title','detail','student_status','add_time']
        read_only_fields=['group', 'add_time']

    def validate_detail(self, value):
        cleaned = clean_rich_text(value)
        text = bleach.clean(cleaned, tags=[], strip=True).replace('\xa0', ' ').strip()
        if not text:
            raise serializers.ValidationError('Les consignes du devoir sont obligatoires.')
        return cleaned
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        self.Meta.depth = 0 if request and request.method in {'POST', 'PUT', 'PATCH'} else 2

class StudentDashboardSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.Student
        fields=['enrolled_courses','favorite_courses','complete_assignments','pending_assignments']
        def __init__(self, *args, **kwargs):
            super(StudentDashboardSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class QuizSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.Quiz
        fields=['id','teacher','title','detail','assign_status','add_time']
        def __init__(self, *args, **kwargs):
            super(QuizSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2
        
class QuestionSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.QuizQuestions
        fields=['id','quiz','questions','ans1','ans2','ans3','ans4','right_ans']
        def __init__(self, *args, **kwargs):
            super(QuestionSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class CourseQuizSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.CourseQuiz
        fields=['id','teacher','course','quiz','add_time']
    def __init__(self, *args, **kwargs):
        super(CourseQuizSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        self.Meta.depth = 0
        if request and request.method == 'GET':
            self.Meta.depth = 2

class LiveClassroomSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = models.LiveClassroom
        fields = ['id', 'course', 'course_title', 'title', 'scheduled_at', 'status', 'created_at', 'started_at', 'ended_at']
        read_only_fields = ['status', 'created_at', 'started_at', 'ended_at']

class LiveClassPollSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    options = serializers.ListField(
        child=serializers.CharField(max_length=120, allow_blank=False, trim_whitespace=True),
        min_length=2,
        max_length=6,
    )
    results = serializers.SerializerMethodField()

    class Meta:
        model = models.LiveClassPoll
        fields = ['id', 'classroom', 'question', 'options', 'is_active', 'created_at', 'results']
        read_only_fields = ['classroom', 'is_active', 'created_at', 'results']

    def validate_options(self, options):
        if len({option.casefold() for option in options}) != len(options):
            raise serializers.ValidationError('Poll options must be unique.')
        return options

    def get_results(self, poll):
        counts = dict(poll.votes.values_list('option_index').annotate(count=Count('id')))
        return [
            {'option': option, 'votes': counts.get(index, 0)}
            for index, option in enumerate(poll.options)
        ]

class AttempQuizSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model=models.AttemptQuiz
        fields=['id','student','quiz','question','right_ans','add_time']
    def __init__(self, *args, **kwargs):
        super(AttempQuizSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        self.Meta.depth = 0
        if request and request.method == 'GET':
            self.Meta.depth = 2

class StudyMaterialSerializer(SecretStrippingMixin, serializers.ModelSerializer):
        class Meta:
            model=models.StudyMaterial
            fields=['id','course','title','description','upload','remarks','ai_summary']
            read_only_fields=['ai_summary']

        def validate_upload(self, value):
            return reject_video_upload(value, 'Video files are not accepted as course study materials.')

        def __init__(self, *args, **kwargs):
            super(StudyMaterialSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class FaqSerializer(SecretStrippingMixin, serializers.ModelSerializer):
        class Meta:
            model=models.Faq
            fields=['id','question','answer']

class FlatPageSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta :
        model=FlatPage
        fields=['id','title','content','url']

class TeacherStudentChatSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_profile_img = serializers.SerializerMethodField()

    class Meta :
        model=models.TeacherStudentChat
        fields=['id','teacher','student','msg_from','msg_to','msg_time','is_read','edited_at','sender_name','sender_profile_img']

    def get_sender_name(self, instance):
        return instance.teacher.full_name if instance.msg_from == 'teacher' else instance.student.fullname

    def get_sender_profile_img(self, instance):
        image = instance.teacher.profile_img if instance.msg_from == 'teacher' else instance.student.profile_img
        if not image:
            return ''
        request = self.context.get('request')
        image_url = image.url
        return request.build_absolute_uri(image_url) if request else image_url


class NotificationSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    class Meta:
        model = models.Notification
        fields = ['id', 'subject', 'message', 'link', 'created_at', 'is_read']


class GroupMessageSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    sender_name = serializers.CharField(read_only=True)
    sender_type = serializers.SerializerMethodField()

    class Meta:
        model = models.GroupMessage
        fields = ['id', 'group', 'message', 'created_at', 'sender_name', 'sender_type']
        read_only_fields = ['group', 'created_at', 'sender_name', 'sender_type']

    def get_sender_type(self, instance):
        return 'student' if instance.student_id else 'teacher'


class CoursePaymentSerializer(SecretStrippingMixin, serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    teacher_name = serializers.CharField(source='course.teacher.full_name', read_only=True)
    student_name = serializers.CharField(source='student.fullname', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    method_label = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = models.CoursePayment
        fields = [
            'id', 'course', 'course_title', 'teacher_name', 'student', 'student_name', 'student_email',
            'method', 'method_label', 'amount', 'expected_amount', 'reference',
            'payer_phone', 'status', 'admin_note', 'amount_received', 'reviewed_at', 'created_at',
        ]
        read_only_fields = fields
