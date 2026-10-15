from django.contrib import admin
from . import models

admin.site.site_header = 'Administration TCiD Center'
admin.site.site_title = 'Administration TCiD Center'
admin.site.index_title = 'Gérer les formations, les formateurs et les apprenants'


@admin.action(description='Bloquer les comptes formateurs sélectionnés')
def block_teachers(modeladmin, request, queryset):
	updated = queryset.update(is_active=False)
	modeladmin.message_user(request, f'{updated} compte(s) formateur(s) bloqué(s).')


@admin.action(description='Réactiver les comptes formateurs sélectionnés')
def reactivate_teachers(modeladmin, request, queryset):
	updated = queryset.update(is_active=True)
	modeladmin.message_user(request, f'{updated} compte(s) formateur(s) réactivé(s).')


@admin.action(description='Bloquer les comptes apprenants sélectionnés')
def block_students(modeladmin, request, queryset):
	updated = queryset.update(is_active=False)
	modeladmin.message_user(request, f'{updated} compte(s) apprenant(s) bloqué(s).')


@admin.action(description='Réactiver les comptes apprenants sélectionnés')
def reactivate_students(modeladmin, request, queryset):
	updated = queryset.update(is_active=True)
	modeladmin.message_user(request, f'{updated} compte(s) apprenant(s) réactivé(s).')


@admin.action(description='Approuver les comptes formateurs sélectionnés')
def approve_teachers(modeladmin, request, queryset):
	updated = queryset.filter(is_approved=False).update(is_approved=True, is_active=True)
	modeladmin.message_user(request, f'{updated} compte(s) formateur(s) approuvé(s).')


@admin.action(description='Approuver les comptes apprenants sélectionnés')
def approve_students(modeladmin, request, queryset):
	updated = queryset.filter(is_approved=False).update(is_approved=True, is_active=True)
	modeladmin.message_user(request, f'{updated} compte(s) apprenant(s) approuvé(s).')


@admin.display(description='État du compte')
def account_status(account):
	if not account.is_approved:
		return 'En attente d’approbation'
	return 'Actif' if account.is_active else 'Bloqué'


@admin.register(models.Teacher)
class TeacherAdmin(admin.ModelAdmin):
	list_display = ('full_name', 'email', 'qualification', 'mobile_no', account_status, 'is_approved', 'is_active')
	list_filter = ('is_approved', 'is_active')
	search_fields = ('full_name', 'email', 'qualification')
	exclude = ('password',)
	actions = (approve_teachers, block_teachers, reactivate_teachers)


@admin.register(models.CourseCategory)
class CourseCategoryAdmin(admin.ModelAdmin):
	list_display = ('title', 'total_courses')
	search_fields = ('title',)


@admin.register(models.Course)
class CourseAdmin(admin.ModelAdmin):
	list_display = ('title', 'category', 'teacher', 'course_views')
	list_filter = ('category',)
	search_fields = ('title', 'teacher__full_name', 'techs')
	list_select_related = ('category', 'teacher')


@admin.register(models.Student)
class StudentAdmin(admin.ModelAdmin):
	list_display = ('fullname', 'email', 'username', account_status, 'is_approved', 'is_active')
	list_filter = ('is_approved', 'is_active')
	search_fields = ('fullname', 'email', 'username')
	exclude = ('password',)
	actions = (approve_students, block_students, reactivate_students)


@admin.register(models.StudentCourseEnrollment)
class StudentCourseEnrollmentAdmin(admin.ModelAdmin):
	list_display = ('student', 'course', 'status', 'enrolled_time')
	list_filter = ('status', 'course__teacher')
	search_fields = ('student__fullname', 'student__email', 'course__title')


@admin.register(models.Notification)
class NotificationAdmin(admin.ModelAdmin):
	list_display = ('subject', 'student', 'teacher', 'is_read', 'created_at')
	list_filter = ('is_read', 'created_at')
	search_fields = ('subject', 'message')


@admin.register(models.Chapter)
class ChapterAdmin(admin.ModelAdmin):
	list_display = ('title', 'course')
	search_fields = ('title', 'course__title')


@admin.register(models.Quiz)
class QuizAdmin(admin.ModelAdmin):
	list_display = ('title', 'teacher', 'add_time')
	search_fields = ('title', 'teacher__full_name')
	list_filter = ('teacher',)


@admin.register(models.QuizQuestions)
class QuizQuestionsAdmin(admin.ModelAdmin):
	list_display = ('questions', 'quiz', 'add_time')
	search_fields = ('questions', 'quiz__title')


@admin.register(models.CourseQuiz)
class CourseQuizAdmin(admin.ModelAdmin):
	list_display = ('course', 'quiz', 'teacher', 'add_time')
	list_filter = ('teacher',)
	search_fields = ('course__title', 'quiz__title')


@admin.register(models.StudyMaterial)
class StudyMaterialAdmin(admin.ModelAdmin):
	list_display = ('title', 'course', 'upload')
	search_fields = ('title', 'course__title')


@admin.register(models.CourseRating)
class CourseRatingAdmin(admin.ModelAdmin):
	list_display = ('course', 'student', 'rating', 'review_time')
	list_filter = ('rating',)
	search_fields = ('course__title', 'student__fullname')


@admin.register(models.StudentFavoriteCourse)
class StudentFavoriteCourseAdmin(admin.ModelAdmin):
	list_display = ('student', 'course', 'status')
	list_filter = ('status',)
	search_fields = ('student__fullname', 'course__title')


@admin.register(models.StudentAssignment)
class StudentAssignmentAdmin(admin.ModelAdmin):
	list_display = ('title', 'teacher', 'student', 'group', 'student_status', 'add_time')
	list_filter = ('student_status', 'teacher')
	search_fields = ('title', 'student__fullname', 'teacher__full_name', 'group__name')


@admin.register(models.AttemptQuiz)
class AttemptQuizAdmin(admin.ModelAdmin):
	list_display = ('student', 'quiz', 'question', 'add_time')
	search_fields = ('student__fullname', 'quiz__title', 'question__questions')


@admin.register(models.Faq)
class FaqAdmin(admin.ModelAdmin):
	list_display = ('question', 'answer_preview')
	search_fields = ('question', 'answer')

	@admin.display(description='Réponse')
	def answer_preview(self, faq):
		return faq.answer[:160] + ('…' if len(faq.answer) > 160 else '')


@admin.register(models.TeacherStudentChat)
class TeacherStudentChatAdmin(admin.ModelAdmin):
	list_display = ('teacher', 'student', 'msg_from', 'msg_time')
	list_filter = ('msg_from', 'teacher')
	search_fields = ('teacher__full_name', 'student__fullname', 'msg_to')
	readonly_fields = ('msg_time',)


@admin.register(models.LearningGroup)
class LearningGroupAdmin(admin.ModelAdmin):
	list_display = ('name', 'member_count', 'created_at')
	search_fields = ('name',)
	readonly_fields = ('created_at',)

	@admin.display(description='Membres')
	def member_count(self, group):
		return group.memberships.count()


@admin.register(models.GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
	list_display = ('group', 'student', 'teacher', 'added_at')
	list_filter = ('group',)
	search_fields = ('group__name', 'student__fullname', 'teacher__full_name')
	readonly_fields = ('added_at',)


@admin.register(models.GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
	list_display = ('group', 'sender_name', 'created_at')
	list_filter = ('group', 'created_at')
	search_fields = ('group__name', 'message', 'student__fullname', 'teacher__full_name')
	readonly_fields = ('created_at',)

	def has_add_permission(self, request):
		return False

	def has_change_permission(self, request, obj=None):
		return False

	def has_delete_permission(self, request, obj=None):
		return False






