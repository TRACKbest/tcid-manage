from django.db import models
from django.core import serializers

class Teacher(models.Model):
    full_name=models.CharField(max_length=100)
    email=models.CharField(max_length=100)
    password=models.CharField(max_length=100,blank=True,null=True)
    is_active=models.BooleanField(default=True)
    is_approved=models.BooleanField(default=True)
    qualification=models.CharField(max_length=500)
    mobile_no=models.CharField(max_length=20)
    profile_img=models.ImageField(upload_to='teacher_profile_imgs/',null=True)
    skills=models.CharField(max_length=20,null=True)

    face_url=models.URLField(null=True,blank=True)
    insta_url=models.URLField(null=True,blank=True)
    twit_url=models.URLField(null=True,blank=True)
    web_url=models.URLField(null=True,blank=True)
    you_url=models.URLField(null=True,blank=True)

    class Meta:
        verbose_name_plural="1. Teacher"

    def __str__(self):
        return self.full_name

    def skill_list(self):
        return [skill.strip() for skill in (self.skills or '').split(',') if skill.strip()]

    def total_teacher_course(self):
        total_course=Course.objects.filter(teacher=self).count()
        return total_course

    def total_teacher_chapters(self):
        total_chapters=Chapter.objects.filter(course__teacher=self).count()
        return total_chapters

    def total_teacher_students(self):
        total_students=StudentCourseEnrollment.objects.filter(
            course__teacher=self,
            status=StudentCourseEnrollment.STATUS_APPROVED,
        ).count()
        return total_students 

class CourseCategory(models.Model):
    title=models.CharField(max_length=100)
    description=models.TextField(blank=True, default='')

    class Meta:
        verbose_name_plural="2. Course Categories"

    def total_courses(self):
        return Course.objects.filter(category=self).count()

    def __str__(self) :
        return self.title

class Course(models.Model):
    category=models.ForeignKey(CourseCategory,on_delete=models.CASCADE, related_name='category_courses')
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE, related_name='teacher_courses')
    title=models.CharField(max_length=150)
    description=models.TextField()
    featured_img=models.ImageField(upload_to='course_imgs/',null=True)
    techs=models.TextField(null=True)
    course_views=models.BigIntegerField(default=0)

    class Meta:
        verbose_name_plural="3. Courses"

    def related_videos(self):
        if not self.techs or not self.techs.strip():
            return serializers.serialize('json', Course.objects.none())
        related_videos=Course.objects.filter(techs__icontains=self.techs).exclude(id=self.id)
        return serializers.serialize('json',related_videos)

    def teach_list(self):
        return [tech.strip() for tech in (self.techs or '').split(',') if tech.strip()]

    def total_enrolled_students(self):
        total_enrolled_students=StudentCourseEnrollment.objects.filter(
            course=self, status=StudentCourseEnrollment.STATUS_APPROVED).count()
        return total_enrolled_students

    def course_rating(self):
        course_rating=CourseRating.objects.filter(course=self).aggregate(avg_rating=models.Avg('rating'))
        return course_rating['avg_rating']
    
    def __str__(self) :
        return self.title

class Chapter(models.Model):
    course=models.ForeignKey(Course,null=True,on_delete=models.CASCADE,related_name='course_chapters')
    title=models.CharField(max_length=150,null=True)
    description=models.TextField()
    video=models.FileField(upload_to='chapter_videos/',null=True)
    remarks=models.TextField(null=True)

    class Meta:
        verbose_name_plural="4. Chapters"


class Student(models.Model):
    fullname=models.CharField(max_length=100)
    email=models.CharField(max_length=100,unique=True)
    password=models.CharField(max_length=100,null=True,blank=True)
    is_active=models.BooleanField(default=True)
    is_approved=models.BooleanField(default=True)
    username=models.CharField(max_length=500)
    interseted_categories=models.TextField()
    profile_img=models.ImageField(upload_to='student_profile_imgs/',null=True)

    def __str__(self) :
        return self.fullname

    def enrolled_courses(self):
        enrolled_courses=StudentCourseEnrollment.objects.filter(
            student=self, status=StudentCourseEnrollment.STATUS_APPROVED).count()
        return enrolled_courses

    def favorite_courses(self):
        favorite_courses=StudentFavoriteCourse.objects.filter(student=self).count()
        return favorite_courses

    def complete_assignments(self):
        complete_assignments=StudentAssignment.objects.filter(student=self,student_status=True).count()
        return complete_assignments

    def pending_assignments(self):
        pending_assignments=StudentAssignment.objects.filter(student=self,student_status=False).count()
        return pending_assignments

    class Meta:
        verbose_name_plural="5. Students"

class StudentCourseEnrollment(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    course=models.ForeignKey(Course,null=True,on_delete=models.CASCADE,related_name='enrolled_courses')
    student=models.ForeignKey(Student,null=True,on_delete=models.CASCADE,related_name='enrolled_student')
    enrolled_time=models.DateTimeField(auto_now_add=True)
    status=models.CharField(max_length=10,choices=STATUS_CHOICES,default=STATUS_PENDING)

    class Meta:
         verbose_name_plural="6. Enrolled Courses"

    def __str__(self) :
        return f"{self.course}-{self.student}"

class CourseRating(models.Model):
    course=models.ForeignKey(Course,on_delete=models.CASCADE,null=True)
    student=models.ForeignKey(Student,on_delete=models.CASCADE,null=True)
    rating=models.PositiveBigIntegerField(default=0)
    reviews=models.TextField(null=True)
    review_time=models.DateTimeField(auto_now_add=True)

    class Meta:
         verbose_name_plural="7. Course Ratings"

    def __str__(self):
        return f"{self.course}-{self.student}-{self.rating}"

class StudentFavoriteCourse(models.Model):
    course=models.ForeignKey(Course,on_delete=models.CASCADE)
    student=models.ForeignKey(Student,on_delete=models.CASCADE)
    status=models.BooleanField(default=False)

    class Meta:
         verbose_name_plural="8. Student Favorite Course"
         constraints=[
             models.UniqueConstraint(fields=['student', 'course'], name='unique_student_course_favorite'),
         ]

class CourseView(models.Model):
    course=models.ForeignKey(Course,on_delete=models.CASCADE,related_name='view_records')
    student=models.ForeignKey(Student,on_delete=models.CASCADE,related_name='course_view_records')
    viewed_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints=[
            models.UniqueConstraint(fields=['student', 'course'], name='unique_student_course_view'),
        ]

class LiveClassroom(models.Model):
    STATUS_SCHEDULED = 'scheduled'
    STATUS_LIVE = 'live'
    STATUS_ENDED = 'ended'
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_LIVE, 'Live'),
        (STATUS_ENDED, 'Ended'),
    ]

    course=models.ForeignKey(Course,on_delete=models.CASCADE,related_name='live_classrooms')
    title=models.CharField(max_length=200)
    scheduled_at=models.DateTimeField(null=True,blank=True)
    status=models.CharField(max_length=10,choices=STATUS_CHOICES,default=STATUS_SCHEDULED)
    created_at=models.DateTimeField(auto_now_add=True)
    started_at=models.DateTimeField(null=True,blank=True)
    ended_at=models.DateTimeField(null=True,blank=True)

    class Meta:
        ordering=['-scheduled_at', '-created_at']

class LiveClassPoll(models.Model):
    classroom=models.ForeignKey(LiveClassroom,on_delete=models.CASCADE,related_name='polls')
    question=models.CharField(max_length=300)
    options=models.JSONField(default=list)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)

class LiveClassPollVote(models.Model):
    poll=models.ForeignKey(LiveClassPoll,on_delete=models.CASCADE,related_name='votes')
    student=models.ForeignKey(Student,on_delete=models.CASCADE,related_name='live_class_votes')
    option_index=models.PositiveSmallIntegerField()
    voted_at=models.DateTimeField(auto_now=True)

    class Meta:
        constraints=[
            models.UniqueConstraint(fields=['poll', 'student'], name='unique_live_poll_student_vote'),
        ]

class StudentAssignment(models.Model):
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE,null=True)
    student=models.ForeignKey(Student,on_delete=models.CASCADE,null=True)
    group=models.ForeignKey('LearningGroup',on_delete=models.SET_NULL,null=True,blank=True,related_name='assignments')
    title=models.CharField(max_length=150)
    detail=models.TextField(null=True)    
    student_status=models.BooleanField(default=False,null=True)
    add_time=models.DateTimeField(auto_now_add=True)

    class Meta:
         verbose_name_plural="9. STudent Assignment"

    def __str__(self):
        return f"{self.title}" 
        
class Quiz(models.Model):   
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE)
    title=models.CharField(max_length=200,null=True)
    detail=models.TextField()
    add_time=models.DateTimeField(auto_now_add=True)

    def assign_status(self):
        return CourseQuiz.objects.filter(quiz=self).count()

    def __str__(self):
        return self.title or f"Questionnaire {self.pk}"

    class Meta:
         verbose_name_plural="11. Quizs"

class QuizQuestions(models.Model):
    quiz=models.ForeignKey(Quiz,on_delete=models.CASCADE,null=True)
    questions=models.CharField(max_length=200)
    ans1=models.CharField(max_length=200)
    ans2=models.CharField(max_length=200)
    ans3=models.CharField(max_length=200)
    ans4=models.CharField(max_length=200)
    right_ans=models.CharField(max_length=200)
    add_time=models.DateTimeField(auto_now_add=True)

    class Meta:
         verbose_name_plural="12. Quiz Question&answer "

class CourseQuiz(models.Model):
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE,null=True)
    course=models.ForeignKey(Course,on_delete=models.CASCADE,null=True)
    quiz=models.ForeignKey(Quiz,on_delete=models.CASCADE,null=True)
    add_time=models.DateTimeField(auto_now_add=True)

    class Meta:
         verbose_name_plural="13. Course Quiz "

class AttemptQuiz(models.Model):
    student=models.ForeignKey(Student,on_delete=models.CASCADE,null=True)
    quiz=models.ForeignKey(Quiz,on_delete=models.CASCADE,null=True)
    question=models.ForeignKey(QuizQuestions,on_delete=models.CASCADE,null=True)
    right_ans=models.CharField(max_length=200,null=True)
    add_time=models.DateTimeField(auto_now_add=True)

    class Meta:
         verbose_name_plural="14. Attempted Questions "

class StudyMaterial(models.Model):
    course=models.ForeignKey(Course,on_delete=models.CASCADE)
    title=models.CharField(max_length=150)
    description=models.TextField()
    upload=models.FileField(upload_to='study_materials/',null=True)
    remarks=models.TextField(null=True)
    extracted_text=models.TextField(blank=True,default='')
    ai_summary=models.TextField(blank=True,default='')

    class Meta:
         verbose_name_plural="15. Course Materials"

class AICachedResponse(models.Model):
    FEATURE_CHOICES = [
        ('tutor', 'Tutor'),
        ('feedback', 'Feedback'),
    ]

    course=models.ForeignKey(Course,on_delete=models.CASCADE,related_name='ai_cached_responses')
    feature=models.CharField(max_length=16,choices=FEATURE_CHOICES)
    cache_key=models.CharField(max_length=64)
    response=models.TextField()
    metadata=models.JSONField(default=list)
    created_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints=[
            models.UniqueConstraint(fields=['feature', 'cache_key'], name='unique_ai_feature_cache_key'),
        ]

class AIAssistantQuestion(models.Model):
    TOPIC_CHOICES = [
        ('code', 'Code'),
        ('concept', 'Concept'),
        ('exam', 'Exam'),
        ('setup', 'Setup'),
        ('other', 'Other'),
    ]

    course=models.ForeignKey(Course,on_delete=models.CASCADE,related_name='ai_questions')
    question=models.CharField(max_length=1000,blank=True,default='')
    normalized_question=models.CharField(max_length=1000,blank=True,default='',db_index=True)
    answer=models.TextField(blank=True,default='')
    topic=models.CharField(max_length=16,choices=TOPIC_CHOICES,default='other')
    created_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering=['-created_at']

class Faq(models.Model):
    question=models.CharField(max_length=300)
    answer=models.TextField()

    class Meta:
         verbose_name_plural="16. FAQ "

class TeacherStudentChat(models.Model):
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE)
    student=models.ForeignKey(Student,on_delete=models.CASCADE)
    msg_to=models.TextField()
    msg_from=models.CharField(max_length=100)
    msg_time=models.DateTimeField(auto_now_add=True)
    is_read=models.BooleanField(default=False)
    edited_at=models.DateTimeField(null=True,blank=True)

    class Meta:
         verbose_name_plural="17. ChatBot "


class LearningGroup(models.Model):
    name=models.CharField(max_length=120)
    cover_image=models.ImageField(upload_to='group_covers/',null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering=['name', 'id']

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    group=models.ForeignKey(LearningGroup,on_delete=models.CASCADE,related_name='memberships')
    student=models.ForeignKey(Student,on_delete=models.CASCADE,null=True,blank=True,related_name='group_memberships')
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE,null=True,blank=True,related_name='group_memberships')
    added_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints=[
            models.UniqueConstraint(fields=['group', 'student'], condition=models.Q(student__isnull=False), name='unique_group_student_member'),
            models.UniqueConstraint(fields=['group', 'teacher'], condition=models.Q(teacher__isnull=False), name='unique_group_teacher_member'),
            models.CheckConstraint(
                condition=(models.Q(student__isnull=False, teacher__isnull=True) | models.Q(student__isnull=True, teacher__isnull=False)),
                name='group_member_has_one_account',
            ),
        ]

    def __str__(self):
        member = self.student.fullname if self.student_id else self.teacher.full_name
        return f'{self.group}: {member}'


class GroupMessage(models.Model):
    group=models.ForeignKey(LearningGroup,on_delete=models.CASCADE,related_name='messages')
    student=models.ForeignKey(Student,on_delete=models.CASCADE,null=True,blank=True,related_name='group_messages')
    teacher=models.ForeignKey(Teacher,on_delete=models.CASCADE,null=True,blank=True,related_name='group_messages')
    message=models.TextField()
    created_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering=['created_at', 'id']
        constraints=[
            models.CheckConstraint(
                condition=(models.Q(student__isnull=False, teacher__isnull=True) | models.Q(student__isnull=True, teacher__isnull=False)),
                name='group_message_has_one_sender',
            ),
        ]

    @property
    def sender_name(self):
        return self.student.fullname if self.student_id else self.teacher.full_name


class Notification(models.Model):
    teacher = models.ForeignKey(Teacher, null=True, blank=True, on_delete=models.CASCADE, related_name='notifications')
    student = models.ForeignKey(Student, null=True, blank=True, on_delete=models.CASCADE, related_name='notifications')
    subject = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.subject