from rest_framework import serializers
from django.db.models import Count
import bleach
from . import models
from django.contrib.flatpages.models import FlatPage


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.Teacher
        fields=['id','full_name','email','password','is_active','is_approved','qualification','mobile_no','skills','profile_img','teacher_courses','skill_list','total_teacher_course','face_url','insta_url','twit_url','web_url','you_url']
        extra_kwargs = {
            'is_active': {'read_only': True},
            'is_approved': {'read_only': True},
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

class CategorySerializer(serializers.ModelSerializer):
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

class CourseSerializer(serializers.ModelSerializer):
    
    class Meta:
        model=models.Course
        fields=['id','category','teacher','title','description','featured_img','techs','course_chapters','related_videos','teach_list','total_enrolled_students','course_rating']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
        }

    def validate_description(self, value):
        allowed_tags = {
            'a', 'blockquote', 'br', 'em', 'h1', 'h2', 'h3', 'li',
            'ol', 'p', 's', 'span', 'strong', 'u', 'ul',
        }
        allowed_attributes = {
            'a': ['href', 'rel', 'target'],
            'h1': ['class'],
            'h2': ['class'],
            'h3': ['class'],
            'li': ['class', 'data-list'],
            'ol': ['class'],
            'p': ['class'],
            'span': ['class'],
            'ul': ['class'],
        }
        return bleach.clean(
            value or '',
            tags=allowed_tags,
            attributes=allowed_attributes,
            protocols={'http', 'https', 'mailto'},
            strip=True,
        )

    def __init__(self, *args, **kwargs):
            super(CourseSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class ChapterSerializer(serializers.ModelSerializer):
        class Meta:
            model=models.Chapter
            fields=['id','course','title','description','video','remarks']
        def __init__(self, *args, **kwargs):
            super(ChapterSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2 

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.Student
        fields=['id','fullname','email','password','is_active','is_approved','username','interseted_categories','profile_img']
        extra_kwargs = {
            'is_active': {'read_only': True},
            'is_approved': {'read_only': True},
        }
    def __init__(self, *args, **kwargs):
            super(StudentSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class StudentCourseEnrollSerializer(serializers.ModelSerializer):        
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
            

class StudentFavoriteCourseSerializer(serializers.ModelSerializer):
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

class CourseRatingSerializer(serializers.ModelSerializer):
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

class TeacherDashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.Teacher
        fields=['total_teacher_course','total_teacher_chapters','total_teacher_students']

class StudentAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.StudentAssignment
        fields=['id','teacher','student','group','title','detail','student_status','add_time']
        read_only_fields=['group', 'add_time']

    def validate_detail(self, value):
        allowed_tags = {
            'a', 'blockquote', 'br', 'em', 'h1', 'h2', 'h3', 'li',
            'ol', 'p', 's', 'span', 'strong', 'u', 'ul',
        }
        allowed_attributes = {
            'a': ['href', 'rel', 'target'],
            'h1': ['class'],
            'h2': ['class'],
            'h3': ['class'],
            'li': ['class', 'data-list'],
            'ol': ['class'],
            'p': ['class'],
            'span': ['class'],
            'ul': ['class'],
        }
        cleaned = bleach.clean(
            value or '',
            tags=allowed_tags,
            attributes=allowed_attributes,
            protocols={'http', 'https', 'mailto'},
            strip=True,
        )
        text = bleach.clean(cleaned, tags=[], strip=True).replace('\xa0', ' ').strip()
        if not text:
            raise serializers.ValidationError('Les consignes du devoir sont obligatoires.')
        return cleaned
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        self.Meta.depth = 0 if request and request.method in {'POST', 'PUT', 'PATCH'} else 2

class StudentDashboardSerializer(serializers.ModelSerializer):
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

class QuizSerializer(serializers.ModelSerializer):
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
        
class QuestionSerializer(serializers.ModelSerializer):
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

class CourseQuizSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.CourseQuiz
        fields=['id','teacher','course','quiz','add_time']
    def __init__(self, *args, **kwargs):
        super(CourseQuizSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        self.Meta.depth = 0
        if request and request.method == 'GET':
            self.Meta.depth = 2

class LiveClassroomSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = models.LiveClassroom
        fields = ['id', 'course', 'course_title', 'title', 'scheduled_at', 'status', 'created_at', 'started_at', 'ended_at']
        read_only_fields = ['status', 'created_at', 'started_at', 'ended_at']

class LiveClassPollSerializer(serializers.ModelSerializer):
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

class AttempQuizSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.AttemptQuiz
        fields=['id','student','quiz','question','right_ans','add_time']
    def __init__(self, *args, **kwargs):
        super(AttempQuizSerializer, self).__init__(*args, **kwargs)
        request = self.context.get('request')
        self.Meta.depth = 0
        if request and request.method == 'GET':
            self.Meta.depth = 2

class StudyMaterialSerializer(serializers.ModelSerializer):
        class Meta:
            model=models.StudyMaterial
            fields=['id','course','title','description','upload','remarks','ai_summary']
            read_only_fields=['ai_summary']

        def validate_upload(self, value):
            video_extensions = {
                '3gp', 'avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4',
                'mpeg', 'mpg', 'ogv', 'webm', 'wmv',
            }
            extension = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
            content_type = getattr(value, 'content_type', '') or ''
            if extension in video_extensions or content_type.startswith('video/'):
                raise serializers.ValidationError('Video files are not accepted as course study materials.')
            return value

        def __init__(self, *args, **kwargs):
            super(StudyMaterialSerializer, self).__init__(*args, **kwargs)
            request = self.context.get('request')
            if request and request.method in {'POST', 'PUT', 'PATCH'}:
                self.Meta.depth = 0
            else:
                self.Meta.depth = 2

class FaqSerializer(serializers.ModelSerializer):
        class Meta:
            model=models.Faq
            fields=['id','question','answer']

class FlatPageSerializer(serializers.ModelSerializer):
    class Meta :
        model=FlatPage
        fields=['id','title','content','url']

class TeacherStudentChatSerializer(serializers.ModelSerializer):
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


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Notification
        fields = ['id', 'subject', 'message', 'link', 'created_at', 'is_read']


class GroupMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(read_only=True)
    sender_type = serializers.SerializerMethodField()

    class Meta:
        model = models.GroupMessage
        fields = ['id', 'group', 'message', 'created_at', 'sender_name', 'sender_type']
        read_only_fields = ['group', 'created_at', 'sender_name', 'sender_type']

    def get_sender_type(self, instance):
        return 'student' if instance.student_id else 'teacher'