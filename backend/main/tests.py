from datetime import datetime, time
import json
from unittest.mock import patch
from urllib.parse import urlencode
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError as SerializerValidationError
from rest_framework.test import APIClient, APIRequestFactory
from .models import AIAssistantQuestion, Course, CourseCategory, CourseQuiz, CourseView, Faq, GroupMembership, GroupMessage, LearningGroup, LiveClassroom, LiveClassPoll, Notification, Quiz, QuizQuestions, Student, StudentAssignment, StudentCourseEnrollment, StudentFavoriteCourse, StudyMaterial, Teacher, TeacherStudentChat
from .admin_api import _display_value
from .serializers import CourseSerializer, StudentAssignmentSerializer
from .views import CourseList, PopularCourseList, TeacherList
from lms_api.asgi import application


class CourseListTests(TestCase):
	def setUp(self):
		self.category = CourseCategory.objects.create(
			title='Programming', description='Programming courses')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		Course.objects.create(
			category=self.category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python',
		)

	def test_popular_courses_work_without_result_parameter(self):
		request = APIRequestFactory().get('/api/course/?popular=1')

		response = CourseList.as_view()(request)

		self.assertEqual(response.status_code, 200)

	def test_teacher_list_returns_all_teachers_without_popular_filter(self):
		request = APIRequestFactory().get('/api/teacher/')

		response = TeacherList.as_view()(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)

	def test_course_description_is_optional_and_sanitized(self):
		serializer = CourseSerializer()
		self.assertFalse(serializer.fields['description'].required)

		cleaned = serializer.validate_description(
			'<h2 class="ql-align-center">Programme</h2><script>alert(1)</script><p><strong>Point clé</strong></p>'
		)

		self.assertIn('<h2 class="ql-align-center">Programme</h2>', cleaned)
		self.assertIn('<strong>Point clé</strong>', cleaned)
		self.assertNotIn('<script>', cleaned)


class PopularContentTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = CourseCategory.objects.create(title='Programming')

	def create_teacher(self, suffix):
		return Teacher.objects.create(
			full_name=f'Teacher {suffix}',
			email=f'teacher-{suffix}@example.com',
			qualification='Computer science',
			mobile_no=f'1234567{suffix:03d}',
		)

	def create_course(self, teacher, suffix):
		return Course.objects.create(
			category=self.category,
			teacher=teacher,
			title=f'Course {suffix}',
			description='Course description',
		)

	def add_enrollments(self, course, approved_count=0, pending_count=0, suffix=''):
		for index in range(approved_count + pending_count):
			student = Student.objects.create(
				fullname=f'Student {suffix}-{index}',
				email=f'student-{suffix}-{index}@example.com',
				username=f'student-{suffix}-{index}',
				interseted_categories='Programming',
			)
			status = StudentCourseEnrollment.STATUS_APPROVED if index < approved_count else StudentCourseEnrollment.STATUS_PENDING
			StudentCourseEnrollment.objects.create(course=course, student=student, status=status)

	def test_popular_courses_include_unrated_courses_ranked_by_approved_enrollments(self):
		teacher = self.create_teacher(1)
		courses = [self.create_course(teacher, index) for index in range(4)]
		self.add_enrollments(courses[0], approved_count=3, suffix='first')
		self.add_enrollments(courses[1], approved_count=2, suffix='second')
		self.add_enrollments(courses[2], approved_count=1, suffix='third')
		self.add_enrollments(courses[3], pending_count=4, suffix='pending')

		response = self.client.get('/api/popular-courses/?popular=1')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[item['id'] for item in response.data['results']],
			[course.id for course in courses[:3]],
		)
		self.assertTrue(all(item['course_rating'] is None for item in response.data['results']))

	def test_popular_teachers_rank_by_approved_enrollments_and_include_zero_student_teachers(self):
		most_followed = self.create_teacher(1)
		second_most_followed = self.create_teacher(2)
		no_students = self.create_teacher(3)
		without_course = self.create_teacher(4)
		most_followed_courses = [
			self.create_course(most_followed, 1),
			self.create_course(most_followed, 2),
		]
		shared_student = Student.objects.create(
			fullname='Shared Student',
			email='shared-student@example.com',
			username='shared-student',
			interseted_categories='Programming',
		)
		for course in most_followed_courses:
			StudentCourseEnrollment.objects.create(
				course=course,
				student=shared_student,
				status=StudentCourseEnrollment.STATUS_APPROVED,
			)
		self.add_enrollments(self.create_course(second_most_followed, 3), approved_count=2, suffix='teacher-two')
		self.add_enrollments(self.create_course(no_students, 4), pending_count=2, suffix='teacher-three')

		response = self.client.get('/api/popular-teachers/?popular=1')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[item['id'] for item in response.data],
			[second_most_followed.id, most_followed.id, no_students.id],
		)
		self.assertNotIn(without_course.id, [item['id'] for item in response.data])


class CourseEngagementTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = CourseCategory.objects.create(title='Programming')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		self.course = Course.objects.create(
			category=self.category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			username='grace',
			interseted_categories='Programming',
		)

	def test_favorite_can_only_be_added_once_and_status_is_available(self):
		payload = {'course': self.course.pk, 'student': self.student.pk, 'status': True}
		first_response = self.client.post('/api/student-add-favorte-course/', payload, format='multipart')
		second_response = self.client.post('/api/student-add-favorte-course/', payload, format='multipart')

		self.assertEqual(first_response.status_code, 201)
		self.assertEqual(second_response.status_code, 200)
		self.assertEqual(StudentFavoriteCourse.objects.filter(course=self.course, student=self.student).count(), 1)
		status_response = self.client.get(
			f'/api/fetch-favorite-status/{self.student.pk}/{self.course.pk}')
		self.assertEqual(status_response.json(), {'bool': True})

	def test_each_student_counts_at_most_one_view_per_course(self):
		url = f'/api/update-view/{self.course.pk}?student_id={self.student.pk}'
		first_response = self.client.get(url)
		second_response = self.client.get(url)

		self.assertEqual(first_response.json(), {'views': 1})
		self.assertEqual(second_response.json(), {'views': 1})
		self.assertEqual(CourseView.objects.filter(course=self.course, student=self.student).count(), 1)
		self.assertEqual(Course.objects.get(pk=self.course.pk).course_views, 1)


class LiveClassroomApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = CourseCategory.objects.create(title='Programming')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		self.course = Course.objects.create(
			category=self.category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			username='grace',
			interseted_categories='Programming',
		)
		StudentCourseEnrollment.objects.create(
			course=self.course,
			student=self.student,
			status=StudentCourseEnrollment.STATUS_APPROVED,
		)
		self.pending_student = Student.objects.create(
			fullname='Katherine Johnson',
			email='katherine@example.com',
			username='katherine',
			interseted_categories='Programming',
		)
		StudentCourseEnrollment.objects.create(
			course=self.course,
			student=self.pending_student,
			status=StudentCourseEnrollment.STATUS_PENDING,
		)

	def test_teacher_can_run_a_poll_for_enrolled_students(self):
		create_response = self.client.post(
			f'/api/courses/{self.course.pk}/live-classrooms/',
			{
				'teacher_id': self.teacher.pk,
				'title': 'Python live',
				'scheduled_at': '2030-06-15T14:30:00Z',
			},
			format='json',
		)
		self.assertEqual(create_response.status_code, 201, create_response.data)
		classroom_id = create_response.data['id']
		scheduled_notification = Notification.objects.get(
			student=self.student,
			subject='Classe virtuelle programmée',
		)
		self.assertIn('15/06/2030', scheduled_notification.message)
		self.assertEqual(scheduled_notification.link, f'/live-classroom/{self.course.pk}')
		self.assertFalse(Notification.objects.filter(
			student=self.pending_student,
			subject='Classe virtuelle programmée',
		).exists())

		start_response = self.client.post(
			f'/api/live-classrooms/{classroom_id}/start/',
			{'teacher_id': self.teacher.pk},
			format='json',
		)
		self.assertEqual(start_response.status_code, 200, start_response.data)
		started_notification = Notification.objects.get(
			student=self.student,
			subject='Classe virtuelle en direct',
		)
		self.assertIn('a commencé', started_notification.message)
		self.assertEqual(started_notification.link, f'/live-classroom/{self.course.pk}')
		self.assertFalse(Notification.objects.filter(
			student=self.pending_student,
			subject='Classe virtuelle en direct',
		).exists())

		repeated_start_response = self.client.post(
			f'/api/live-classrooms/{classroom_id}/start/',
			{'teacher_id': self.teacher.pk},
			format='json',
		)
		self.assertEqual(repeated_start_response.status_code, 200, repeated_start_response.data)
		self.assertEqual(
			Notification.objects.filter(student=self.student, subject='Classe virtuelle en direct').count(),
			1,
		)

		join_response = self.client.post(
			f'/api/live-classrooms/{classroom_id}/join/',
			{'student_id': self.student.pk},
			format='json',
		)
		self.assertEqual(join_response.status_code, 200, join_response.data)
		self.assertEqual(join_response.data['role'], 'student')
		self.assertTrue(join_response.data['token'])

		poll_response = self.client.post(
			f'/api/live-classrooms/{classroom_id}/polls/',
			{
				'teacher_id': self.teacher.pk,
				'question': 'Which language are we using?',
				'options': ['Python', 'JavaScript'],
			},
			format='json',
		)
		self.assertEqual(poll_response.status_code, 201, poll_response.data)

		vote_url = f'/api/live-class-polls/{poll_response.data["id"]}/vote/'
		vote_response = self.client.post(
			vote_url,
			{'student_id': self.student.pk, 'option_index': 0},
			format='json',
		)
		self.assertEqual(vote_response.status_code, 200, vote_response.data)
		self.assertEqual(vote_response.data['results'][0]['votes'], 1)
		duplicate_response = self.client.post(
			vote_url,
			{'student_id': self.student.pk, 'option_index': 1},
			format='json',
		)
		self.assertEqual(duplicate_response.status_code, 409)

		end_response = self.client.post(
			f'/api/live-classrooms/{classroom_id}/end/',
			{'teacher_id': self.teacher.pk},
			format='json',
		)
		self.assertEqual(end_response.status_code, 200, end_response.data)
		ended_notification = Notification.objects.get(
			student=self.student,
			subject='Classe virtuelle terminée',
		)
		self.assertIn('est terminée', ended_notification.message)
		self.assertEqual(ended_notification.link, f'/live-classroom/{self.course.pk}')
		self.assertFalse(Notification.objects.filter(
			student=self.pending_student,
			subject='Classe virtuelle terminée',
		).exists())

		repeated_end_response = self.client.post(
			f'/api/live-classrooms/{classroom_id}/end/',
			{'teacher_id': self.teacher.pk},
			format='json',
		)
		self.assertEqual(repeated_end_response.status_code, 200, repeated_end_response.data)
		self.assertEqual(
			Notification.objects.filter(student=self.student, subject='Classe virtuelle terminée').count(),
			1,
		)

	def test_non_enrolled_student_cannot_list_classroom_sessions(self):
		response = self.client.get(
			f'/api/courses/{self.course.pk}/live-classrooms/?student_id={self.pending_student.pk}')
		self.assertEqual(response.status_code, 403)


class LiveClassroomWebSocketTests(TransactionTestCase):
	def setUp(self):
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		category = CourseCategory.objects.create(title='Programming')
		course = Course.objects.create(
			category=category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			username='grace',
			interseted_categories='Programming',
		)
		StudentCourseEnrollment.objects.create(
			course=course,
			student=self.student,
			status=StudentCourseEnrollment.STATUS_APPROVED,
		)
		self.classroom = LiveClassroom.objects.create(
			course=course,
			title='Python live',
			status=LiveClassroom.STATUS_LIVE,
		)
		client = APIClient()
		teacher_join = client.post(
			f'/api/live-classrooms/{self.classroom.pk}/join/',
			{'teacher_id': self.teacher.pk},
			format='json',
		)
		student_join = client.post(
			f'/api/live-classrooms/{self.classroom.pk}/join/',
			{'student_id': self.student.pk},
			format='json',
		)
		self.assertEqual(teacher_join.status_code, 200, teacher_join.data)
		self.assertEqual(student_join.status_code, 200, student_join.data)
		self.teacher_token = teacher_join.data['token']
		self.student_token = student_join.data['token']

	@override_settings(ALLOWED_HOSTS=['testserver'])
	def test_websocket_relays_hands_moderation_and_peer_signals(self):
		async def exercise_room():
			teacher_socket = WebsocketCommunicator(
				application,
				f'/ws/live-classrooms/{self.classroom.pk}/?{urlencode({"token": self.teacher_token})}',
				headers=[(b'origin', b'http://testserver')],
			)
			student_socket = WebsocketCommunicator(
				application,
				f'/ws/live-classrooms/{self.classroom.pk}/?{urlencode({"token": self.student_token})}',
				headers=[(b'origin', b'http://testserver')],
			)
			teacher_connected, teacher_close_code = await teacher_socket.connect(timeout=5)
			self.assertTrue(teacher_connected, f'WebSocket rejected with close code {teacher_close_code}')
			teacher_joined = await teacher_socket.receive_json_from(timeout=5)
			await teacher_socket.receive_json_from(timeout=5)
			student_connected, student_close_code = await student_socket.connect(timeout=5)
			self.assertTrue(student_connected, f'WebSocket rejected with close code {student_close_code}')
			student_joined = await student_socket.receive_json_from(timeout=5)
			await student_socket.receive_json_from(timeout=5)
			await teacher_socket.receive_json_from(timeout=5)

			await student_socket.send_json_to({'type': 'roster_request'})
			student_roster_request = await student_socket.receive_json_from(timeout=5)
			teacher_roster_request = await teacher_socket.receive_json_from(timeout=5)
			await teacher_socket.send_json_to({
				'type': 'roster_response',
				'target': student_joined['peer_id'],
			})
			student_roster = await student_socket.receive_json_from(timeout=5)

			await student_socket.send_json_to({'type': 'raise_hand', 'up': True})
			await student_socket.receive_json_from(timeout=5)
			hand_event = await teacher_socket.receive_json_from(timeout=5)
			await teacher_socket.send_json_to({
				'type': 'moderate',
				'target': student_joined['peer_id'],
				'control': 'microphone',
				'enabled': False,
			})
			moderation_event = await student_socket.receive_json_from(timeout=5)
			await teacher_socket.send_json_to({
				'type': 'signal',
				'target': student_joined['peer_id'],
				'signal': {'type': 'offer', 'sdp': 'test-sdp'},
			})
			signal_event = await student_socket.receive_json_from(timeout=5)
			await teacher_socket.send_json_to({
				'type': 'whiteboard',
				'stroke': {'color': '#00a99d', 'points': [{'x': 0.1, 'y': 0.2}, {'x': 0.3, 'y': 0.4}]},
			})
			whiteboard_event = await student_socket.receive_json_from(timeout=5)
			await student_socket.disconnect()
			await teacher_socket.disconnect()
			return teacher_connected, student_connected, teacher_joined, student_joined, student_roster_request, teacher_roster_request, student_roster, hand_event, moderation_event, signal_event, whiteboard_event

		result = async_to_sync(exercise_room)()
		teacher_connected, student_connected, teacher_joined, student_joined, student_roster_request, teacher_roster_request, student_roster, hand_event, moderation_event, signal_event, whiteboard_event = result
		self.assertTrue(teacher_connected)
		self.assertTrue(student_connected)
		self.assertEqual(teacher_joined['role'], 'teacher')
		self.assertEqual(student_roster_request['type'], 'roster_request')
		self.assertEqual(teacher_roster_request['requester'], student_joined['peer_id'])
		self.assertEqual(student_roster['type'], 'roster_response')
		self.assertEqual(student_roster['participant']['role'], 'teacher')
		self.assertEqual(hand_event['type'], 'raise_hand')
		self.assertEqual(moderation_event['type'], 'moderate')
		self.assertEqual(signal_event['signal']['sdp'], 'test-sdp')
		self.assertEqual(whiteboard_event['type'], 'whiteboard')
		self.assertEqual(whiteboard_event['stroke']['points'][1], {'x': 0.3, 'y': 0.4})


class AIFeatureApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		category = CourseCategory.objects.create(title='Programming')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		self.course = Course.objects.create(
			category=category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python programming and data structures. Lists contain mutable values.',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			username='grace',
			interseted_categories='Programming',
		)
		StudentCourseEnrollment.objects.create(
			course=self.course,
			student=self.student,
			status=StudentCourseEnrollment.STATUS_APPROVED,
		)
		self.material = StudyMaterial.objects.create(
			course=self.course,
			title='Python notes',
			description='Notes on lists and tuples.',
			extracted_text=(
				'Lists are mutable ordered collections. Python lists support append and indexing. '
			) * 45,
		)

	@override_settings(OPENAI_API_KEY='')
	def test_tutor_reports_missing_key_without_calling_provider(self):
		response = self.client.post(
			f'/api/ai/courses/{self.course.pk}/tutor/',
			{'student_id': self.student.pk, 'question': 'What is a list?'},
			format='json',
		)

		self.assertEqual(response.status_code, 503)
		self.assertEqual(AIAssistantQuestion.objects.count(), 0)

	@override_settings(OPENAI_API_KEY='test-key')
	def test_tutor_uses_and_caches_course_context(self):
		with patch('main.ai_services._complete', return_value='A list is mutable.') as completion:
			first = self.client.post(
				f'/api/ai/courses/{self.course.pk}/tutor/',
				{'student_id': self.student.pk, 'question': 'How are lists mutable?'},
				format='json',
			)
			second = self.client.post(
				f'/api/ai/courses/{self.course.pk}/tutor/',
				{'student_id': self.student.pk, 'question': 'How are lists mutable?'},
				format='json',
			)

		self.assertEqual(first.status_code, 200, first.data)
		self.assertEqual(second.status_code, 200, second.data)
		self.assertEqual(first.data['answer'], 'A list is mutable.')
		self.assertFalse(first.data['cached'])
		self.assertTrue(second.data['cached'])
		self.assertEqual(completion.call_count, 1)
		context_prompt = completion.call_args.args[1]
		self.assertLessEqual(
			context_prompt.count('[Python notes]') + context_prompt.count('[Python]'),
			3,
		)
		self.assertEqual(AIAssistantQuestion.objects.count(), 2)
		stored_question = AIAssistantQuestion.objects.filter(course=self.course).first()
		self.assertEqual(stored_question.question, 'How are lists mutable?')
		self.assertEqual(stored_question.normalized_question, 'how are lists mutable')
		self.assertEqual(stored_question.answer, 'A list is mutable.')

	@override_settings(OPENAI_API_KEY='test-key')
	def test_tutor_cache_is_invalidated_when_course_content_changes(self):
		with patch('main.ai_services._complete', side_effect=['First answer.', 'Updated answer.']) as completion:
			first = self.client.post(
				f'/api/ai/courses/{self.course.pk}/tutor/',
				{'student_id': self.student.pk, 'question': 'How are lists mutable?'},
				format='json',
			)
			self.material.extracted_text += ' Lists can also store mixed data types.'
			self.material.save(update_fields=['extracted_text'])
			second = self.client.post(
				f'/api/ai/courses/{self.course.pk}/tutor/',
				{'student_id': self.student.pk, 'question': 'How are lists mutable?'},
				format='json',
			)

		self.assertEqual(first.status_code, 200, first.data)
		self.assertEqual(second.status_code, 200, second.data)
		self.assertEqual(second.data['answer'], 'Updated answer.')
		self.assertFalse(second.data['cached'])
		self.assertEqual(completion.call_count, 2)

	@override_settings(OPENAI_API_KEY='test-key')
	def test_feedback_cache_is_invalidated_when_course_content_changes(self):
		with patch('main.ai_services._complete', side_effect=['First feedback.', 'Updated feedback.']) as completion:
			first = self.client.post(
				f'/api/ai/courses/{self.course.pk}/feedback/',
				{
					'student_id': self.student.pk,
					'question': 'How are lists mutable?',
					'answer': 'Lists can be changed.',
				},
				format='json',
			)
			self.material.extracted_text += ' Lists can also store mixed data types.'
			self.material.save(update_fields=['extracted_text'])
			second = self.client.post(
				f'/api/ai/courses/{self.course.pk}/feedback/',
				{
					'student_id': self.student.pk,
					'question': 'How are lists mutable?',
					'answer': 'Lists can be changed.',
				},
				format='json',
			)

		self.assertEqual(first.status_code, 200, first.data)
		self.assertEqual(second.status_code, 200, second.data)
		self.assertEqual(second.data['feedback'], 'Updated feedback.')
		self.assertFalse(second.data['cached'])
		self.assertEqual(completion.call_count, 2)

	@override_settings(OPENAI_API_KEY='test-key')
	def test_summary_is_generated_once_and_stored(self):
		with patch('main.ai_services._complete', return_value='Résumé du document.') as completion:
			first = self.client.post(
				f'/api/ai/study-materials/{self.material.pk}/summary/',
				{'student_id': self.student.pk},
				format='json',
			)
			second = self.client.post(
				f'/api/ai/study-materials/{self.material.pk}/summary/',
				{'student_id': self.student.pk},
				format='json',
			)

		self.assertEqual(first.status_code, 200, first.data)
		self.assertEqual(second.status_code, 200, second.data)
		self.assertFalse(first.data['cached'])
		self.assertTrue(second.data['cached'])
		self.assertEqual(completion.call_count, 1)
		self.material.refresh_from_db()
		self.assertEqual(self.material.ai_summary, 'Résumé du document.')

	@override_settings(OPENAI_API_KEY='test-key')
	def test_updating_material_regenerates_its_summary(self):
		self.material.ai_summary = 'Ancien résumé.'
		self.material.save(update_fields=['ai_summary'])
		with patch('main.ai_services._complete', return_value='Résumé mis à jour.') as completion:
			response = self.client.patch(
				f'/api/study-materials/{self.material.pk}?teacher_id={self.teacher.pk}',
				{'description': 'Updated course notes with substantial new information.'},
				format='json',
			)

		self.assertEqual(response.status_code, 200, response.data)
		self.material.refresh_from_db()
		self.assertEqual(self.material.ai_summary, 'Résumé mis à jour.')
		self.assertEqual(completion.call_count, 1)

	@override_settings(OPENAI_API_KEY='test-key')
	def test_quiz_generation_batches_and_persists_ten_questions(self):
		quiz = Quiz.objects.create(teacher=self.teacher, title='Python basics', detail='Collections')
		CourseQuiz.objects.create(teacher=self.teacher, course=self.course, quiz=quiz)
		generated = {
			'questions': [
				{
					'question': f'Question {index}?',
					'options': ['A', 'B', 'C', 'D'],
					'answer_index': 0,
				}
				for index in range(10)
			],
		}
		with patch('main.ai_services._complete', return_value=json.dumps(generated)) as completion:
			response = self.client.post(
				f'/api/ai/quizzes/{quiz.pk}/generate/',
				{'teacher_id': self.teacher.pk},
				format='json',
			)

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data['generated'], 10)
		self.assertEqual(QuizQuestions.objects.filter(quiz=quiz).count(), 10)
		self.assertEqual(completion.call_count, 1)

	@override_settings(OPENAI_API_KEY='test-key')
	def test_quiz_generation_rejects_invalid_option_types(self):
		quiz = Quiz.objects.create(teacher=self.teacher, title='Python basics', detail='Collections')
		CourseQuiz.objects.create(teacher=self.teacher, course=self.course, quiz=quiz)
		generated = {
			'questions': [
				{
					'question': f'Question {index}?',
					'options': 'ABCD',
					'answer_index': 0,
				}
				for index in range(10)
			],
		}
		with patch('main.ai_services._complete', return_value=json.dumps(generated)):
			response = self.client.post(
				f'/api/ai/quizzes/{quiz.pk}/generate/',
				{'teacher_id': self.teacher.pk},
				format='json',
			)

		self.assertEqual(response.status_code, 400)
		self.assertEqual(QuizQuestions.objects.filter(quiz=quiz).count(), 0)

	def test_feedback_rejects_answers_over_500_words(self):
		response = self.client.post(
			f'/api/ai/courses/{self.course.pk}/feedback/',
			{
				'student_id': self.student.pk,
				'question': 'Explain lists.',
				'answer': 'word ' * 501,
			},
			format='json',
		)
		self.assertEqual(response.status_code, 400)

	@override_settings(OPENAI_API_KEY='test-key')
	def test_teacher_analytics_returns_sql_topic_counts(self):
		with patch('main.ai_services._complete', return_value='A list is mutable.'):
			self.client.post(
				f'/api/ai/courses/{self.course.pk}/tutor/',
				{'student_id': self.student.pk, 'question': 'How do Python lists work?'},
				format='json',
			)

		response = self.client.get(
			f'/api/ai/courses/{self.course.pk}/analytics/?teacher_id={self.teacher.pk}')

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data['total_questions'], 1)
		self.assertEqual(response.data['topics'][0]['topic'], 'code')


class RegistrationTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def test_student_registration_creates_student(self):
		response = self.client.post('/api/student/', {
			'fullname': 'Grace Hopper',
			'email': 'grace@example.com',
			'password': 'student-password',
			'username': 'grace',
			'interseted_categories': 'Programming',
		}, format='multipart')

		self.assertEqual(response.status_code, 201, response.data)
		student = Student.objects.get(email='grace@example.com')
		self.assertFalse(student.is_approved)
		self.assertFalse(student.is_active)

	def test_teacher_registration_creates_teacher(self):
		response = self.client.post('/api/teacher/', {
			'full_name': 'Katherine Johnson',
			'email': 'katherine@example.com',
			'password': 'teacher-password',
			'qualification': 'Mathematics',
			'mobile_no': '5551234567',
			'skills': 'Java, Python, React, PostgreSQL',
		}, format='multipart')

		self.assertEqual(response.status_code, 201, response.data)
		teacher = Teacher.objects.get(email='katherine@example.com')
		self.assertFalse(teacher.is_approved)
		self.assertFalse(teacher.is_active)
		self.assertEqual(teacher.skills, 'Java, Python, React, PostgreSQL')


class LoginTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			password='student-password',
			username='grace',
			interseted_categories='Programming',
		)
		self.teacher = Teacher.objects.create(
			full_name='Katherine Johnson',
			email='katherine@example.com',
			password='teacher-password',
			qualification='Mathematics',
			mobile_no='5551234567',
		)

	def test_student_login_returns_student_id(self):
		response = self.client.post('/api/student-login', {
			'email': 'grace@example.com',
			'password': 'student-password',
		}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'bool': True, 'student_id': self.student.id})

	def test_teacher_login_returns_teacher_id(self):
		response = self.client.post('/api/teacher-login', {
			'email': 'katherine@example.com',
			'password': 'teacher-password',
		}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'bool': True, 'teacher_id': self.teacher.id})

	def test_blocked_student_cannot_log_in(self):
		self.student.is_active = False
		self.student.save(update_fields=['is_active'])

		response = self.client.post('/api/student-login', {
			'email': 'grace@example.com',
			'password': 'student-password',
		}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'bool': False})

	def test_blocked_teacher_cannot_log_in(self):
		self.teacher.is_active = False
		self.teacher.save(update_fields=['is_active'])

		response = self.client.post('/api/teacher-login', {
			'email': 'katherine@example.com',
			'password': 'teacher-password',
		}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'bool': False})

	def test_unapproved_student_cannot_log_in(self):
		self.student.is_approved = False
		self.student.save(update_fields=['is_approved'])

		response = self.client.post('/api/student-login', {
			'email': 'grace@example.com',
			'password': 'student-password',
		}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'bool': False, 'status': 'pending_approval'})

	def test_unapproved_teacher_cannot_log_in(self):
		self.teacher.is_approved = False
		self.teacher.save(update_fields=['is_approved'])

		response = self.client.post('/api/teacher-login', {
			'email': 'katherine@example.com',
			'password': 'teacher-password',
		}, format='multipart')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'bool': False, 'status': 'pending_approval'})


class AdminApprovalNotificationTests(TestCase):
	def setUp(self):
		admin_user = get_user_model().objects.create_superuser(
			username='admin',
			email='admin@example.com',
			password='admin-password',
		)
		self.client.force_login(admin_user)
		Student.objects.create(
			fullname='Grace Hopper',
			email='pending-student@example.com',
			username='grace',
			interseted_categories='Programming',
			is_active=False,
			is_approved=False,
		)
		Teacher.objects.create(
			full_name='Katherine Johnson',
			email='pending-teacher@example.com',
			qualification='Mathematics',
			mobile_no='5551234567',
			is_active=False,
			is_approved=False,
		)

	def test_react_admin_api_lists_pending_counts_for_all_modules(self):
		response = self.client.get('/api/admin-ui/resources/')

		self.assertEqual(response.status_code, 200)
		resources = {
			(resource['appLabel'], resource['modelName']): resource
			for resource in response.json()['resources']
		}
		self.assertEqual(resources[('main', 'student')]['pendingCount'], 1)
		self.assertEqual(resources[('main', 'teacher')]['pendingCount'], 1)
		self.assertIn(('main', 'course'), resources)

	def test_admin_can_approve_account_from_dashboard_notification(self):
		student = Student.objects.get(email='pending-student@example.com')

		response = self.client.post(f'/api/admin-ui/approvals/student/{student.id}/')

		self.assertEqual(response.status_code, 200, response.content)
		self.assertTrue(response.json()['approved'])
		student.refresh_from_db()
		self.assertTrue(student.is_approved)
		self.assertTrue(student.is_active)


class AdminResourceApiTests(TestCase):
	def setUp(self):
		admin_user = get_user_model().objects.create_superuser(
			username='admin',
			email='admin@example.com',
			password='admin-password',
		)
		self.client.force_login(admin_user)

	def test_admin_can_create_and_search_registered_models(self):
		create_response = self.client.post('/api/admin-ui/resources/main/coursecategory/new/', {
			'title': 'React Console',
			'description': 'Created from the React administration interface.',
		})

		self.assertEqual(create_response.status_code, 200, create_response.content)
		list_response = self.client.get('/api/admin-ui/resources/main/coursecategory/?q=React')

		self.assertEqual(list_response.status_code, 200)
		self.assertEqual(list_response.json()['total'], 1)
		self.assertEqual(list_response.json()['results'][0]['values']['title'], 'React Console')

	def test_admin_can_create_faq_with_answer_and_list_shows_both(self):
		form_response = self.client.get('/api/admin-ui/resources/main/faq/new/')
		self.assertEqual(form_response.status_code, 200, form_response.content)
		fields = {field['name']: field for field in form_response.json()['resource']['fields']}
		self.assertEqual(fields['answer']['type'], 'textarea')

		create_response = self.client.post('/api/admin-ui/resources/main/faq/new/', {
			'question': 'Comment accéder à un cours ?',
			'answer': 'Connectez-vous, puis choisissez un cours depuis le catalogue.',
		})
		self.assertEqual(create_response.status_code, 200, create_response.content)
		self.assertEqual(
			Faq.objects.get(pk=create_response.json()['id']).answer,
			'Connectez-vous, puis choisissez un cours depuis le catalogue.',
		)

		list_response = self.client.get('/api/admin-ui/resources/main/faq/')
		self.assertEqual(list_response.status_code, 200, list_response.content)
		row = list_response.json()['results'][0]['values']
		self.assertEqual(row['question'], 'Comment accéder à un cours ?')
		self.assertEqual(row['answer_preview'], 'Connectez-vous, puis choisissez un cours depuis le catalogue.')

	def test_dashboard_returns_most_frequent_ai_question_and_saved_answer(self):
		category = CourseCategory.objects.create(title='Informatique')
		teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Informatique',
			mobile_no='1234567890',
		)
		course = Course.objects.create(
			category=category,
			teacher=teacher,
			title='Python',
			description='Introduction à Python.',
		)
		AIAssistantQuestion.objects.create(
			course=course,
			question='Comment fonctionne une liste ?',
			normalized_question='comment fonctionne une liste',
			answer='Une liste stocke plusieurs éléments ordonnés.',
			topic='concept',
		)
		AIAssistantQuestion.objects.create(
			course=course,
			question='Comment fonctionne une liste ?',
			normalized_question='comment fonctionne une liste',
			answer='Une liste stocke plusieurs éléments ordonnés.',
			topic='concept',
		)

		response = self.client.get('/api/admin-ui/resources/')

		self.assertEqual(response.status_code, 200, response.content)
		self.assertEqual(response.json()['frequentQuestions'], [{
			'question': 'Comment fonctionne une liste ?',
			'answer': 'Une liste stocke plusieurs éléments ordonnés.',
			'course': 'Python',
			'count': 2,
		}])

	def test_admin_creates_group_and_adds_course_students_in_bulk(self):
		form_response = self.client.get('/api/admin-ui/resources/main/learninggroup/new/')
		self.assertEqual(form_response.status_code, 200, form_response.content)
		self.assertEqual(
			{field['name'] for field in form_response.json()['resource']['fields']},
			{'name', 'cover_image'},
		)
		group_response = self.client.post(
			'/api/admin-ui/resources/main/learninggroup/new/',
			{'name': 'Groupe Python'},
		)
		self.assertEqual(group_response.status_code, 200, group_response.content)
		group = LearningGroup.objects.get(pk=group_response.json()['id'])
		course = Course.objects.create(
			category=CourseCategory.objects.create(title='Programmation'),
			teacher=Teacher.objects.create(
				full_name='Ada Lovelace',
				email='ada@example.com',
				qualification='Informatique',
				mobile_no='1234567890',
			),
			title='Python',
			description='Cours de Python.',
		)
		student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			username='grace',
			interseted_categories='Programmation',
		)
		StudentCourseEnrollment.objects.create(
			course=course,
			student=student,
			status=StudentCourseEnrollment.STATUS_APPROVED,
		)

		response = self.client.post(
			f'/api/admin-ui/groups/{group.pk}/members/',
			json.dumps({
				'filter': 'course_students',
				'courseId': course.pk,
				'candidateIds': [student.pk],
			}),
			content_type='application/json',
		)
		self.assertEqual(response.status_code, 200, response.content)
		self.assertEqual(response.json()['added'], 1)
		self.assertTrue(GroupMembership.objects.filter(group=group, student=student).exists())
		self.assertTrue(Notification.objects.filter(student=student, subject__contains='Groupe Python').exists())

	def test_admin_creates_individual_assignments_for_every_group_student(self):
		teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Informatique',
			mobile_no='1234567890',
		)
		group = LearningGroup.objects.create(name='Groupe Python')
		GroupMembership.objects.create(group=group, teacher=teacher)
		students = [
			Student.objects.create(
				fullname=name,
				email=f'{username}@example.com',
				username=username,
				interseted_categories='Programmation',
			)
			for name, username in [('Grace Hopper', 'grace'), ('Katherine Johnson', 'katherine')]
		]
		for student in students:
			GroupMembership.objects.create(group=group, student=student)
		outsider = Student.objects.create(
			fullname='Dorothy Vaughan',
			email='dorothy@example.com',
			username='dorothy',
			interseted_categories='Programmation',
		)

		response = self.client.post(
			'/api/admin-ui/resources/main/studentassignment/new/',
			{
				'teacher': teacher.pk,
				'group': group.pk,
				'title': 'Exercice Python',
				'detail': '<p><strong>Créer une fonction</strong></p><ol><li>La tester</li></ol>',
			},
		)

		self.assertEqual(response.status_code, 200, response.content)
		self.assertEqual(response.json()['created'], 2)
		assignments = StudentAssignment.objects.filter(group=group)
		self.assertEqual(set(assignments.values_list('student_id', flat=True)), {student.pk for student in students})
		self.assertFalse(assignments.filter(student=outsider).exists())
		self.assertEqual(
			Notification.objects.filter(student__in=students, subject='Nouveau devoir reçu').count(),
			2,
		)
		self.assertTrue(assignments.first().detail.startswith('<p><strong>'))
		self.assertIn('<ol>', assignments.first().detail)

	def test_assignment_detail_sanitizer_preserves_format_and_rejects_empty_content(self):
		serializer = StudentAssignmentSerializer()

		cleaned = serializer.validate_detail(
			'<p><strong>Important</strong> <em>attention</em></p>'
			'<ol><li>Étape 1</li></ol><ul><li>Un point</li></ul>'
			'<script>alert(1)</script>'
		)

		self.assertIn('<strong>Important</strong>', cleaned)
		self.assertIn('<em>attention</em>', cleaned)
		self.assertIn('<ol>', cleaned)
		self.assertIn('<ul>', cleaned)
		self.assertNotIn('<script>', cleaned)
		with self.assertRaises(SerializerValidationError):
			serializer.validate_detail('<p><br></p>')

	def test_only_staff_can_manage_group_members(self):
		group = LearningGroup.objects.create(name='Groupe réservé')
		client = APIClient()

		response = client.get(f'/api/admin-ui/groups/{group.pk}/members/')

		self.assertEqual(response.status_code, 401)

	def test_teacher_choices_display_name_instead_of_default_object_label(self):
		teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Mathematics',
			mobile_no='1234567890',
		)

		response = self.client.get('/api/admin-ui/resources/main/quiz/new/')

		self.assertEqual(response.status_code, 200, response.content)
		teacher_field = next(
			field for field in response.json()['resource']['fields']
			if field['name'] == 'teacher'
		)
		teacher_choice = next(
			choice for choice in teacher_field['choices']
			if choice['value'] == str(teacher.id)
		)
		self.assertEqual(teacher_choice['label'], 'Ada Lovelace')

	def test_quiz_choices_display_title_instead_of_default_object_label(self):
		teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Mathematics',
			mobile_no='1234567890',
		)
		quiz = Quiz.objects.create(
			teacher=teacher,
			title='Évaluation de mathématiques',
			detail='Évaluation des notions de base.',
		)

		response = self.client.get('/api/admin-ui/resources/main/quizquestions/new/')

		self.assertEqual(response.status_code, 200, response.content)
		quiz_field = next(
			field for field in response.json()['resource']['fields']
			if field['name'] == 'quiz'
		)
		quiz_choice = next(
			choice for choice in quiz_field['choices']
			if choice['value'] == str(quiz.id)
		)
		self.assertEqual(quiz_choice['label'], 'Évaluation de mathématiques')

	def test_admin_user_creation_shows_editable_account_fields_without_managed_dates(self):
		response = self.client.get('/api/admin-ui/resources/auth/user/new/')

		self.assertEqual(response.status_code, 200, response.content)
		field_names = {
			field['name'] for field in response.json()['resource']['fields']
		}
		self.assertTrue({
			'username',
			'first_name',
			'last_name',
			'email',
			'is_active',
			'is_staff',
			'is_superuser',
			'groups',
			'user_permissions',
			'password1',
			'password2',
		}.issubset(field_names))
		self.assertNotIn('date_joined', field_names)
		self.assertNotIn('last_login', field_names)

		user = get_user_model().objects.get(username='admin')
		edit_response = self.client.get(
			f'/api/admin-ui/resources/auth/user/{user.id}/'
		)
		self.assertEqual(edit_response.status_code, 200, edit_response.content)
		edit_field_names = {
			field['name'] for field in edit_response.json()['resource']['fields']
		}
		self.assertIn('email', edit_field_names)
		self.assertNotIn('date_joined', edit_field_names)
		self.assertNotIn('last_login', edit_field_names)

	def test_admin_can_create_user_with_automatically_managed_join_date(self):
		response = self.client.post('/api/admin-ui/resources/auth/user/new/', {
			'username': 'new-admin-user',
			'first_name': 'Ada',
			'last_name': 'Lovelace',
			'email': 'ada@example.com',
			'is_active': 'true',
			'is_staff': 'false',
			'is_superuser': 'false',
			'usable_password': 'true',
			'password1': 'secure-test-password-123',
			'password2': 'secure-test-password-123',
		})

		self.assertEqual(response.status_code, 200, response.content)
		user = get_user_model().objects.get(username='new-admin-user')
		self.assertEqual(user.first_name, 'Ada')
		self.assertEqual(user.last_name, 'Lovelace')
		self.assertEqual(user.email, 'ada@example.com')
		self.assertTrue(user.check_password('secure-test-password-123'))
		self.assertIsNotNone(user.date_joined)

	def test_admin_dates_are_rendered_in_local_format(self):
		self.assertEqual(
			_display_value(datetime(2023, 3, 15, 14, 25, 9, 678745)),
			'15/03/2023 14:25',
		)
		self.assertEqual(_display_value(time(14, 25, 9)), '14:25')

	def test_every_registered_admin_model_can_be_listed(self):
		resources_response = self.client.get('/api/admin-ui/resources/')
		self.assertEqual(resources_response.status_code, 200)

		resources = resources_response.json()['resources']
		self.assertNotIn(('flatpages', 'flatpage'), {
			(resource['appLabel'], resource['modelName']) for resource in resources
		})
		for resource in resources:
			resource_response = self.client.get(
				f"/api/admin-ui/resources/{resource['appLabel']}/{resource['modelName']}/"
			)
			self.assertEqual(
				resource_response.status_code,
				200,
				f"{resource['appLabel']}.{resource['modelName']}: {resource_response.content!r}",
			)

	def test_static_pages_are_unavailable_in_react_admin_api(self):
		response = self.client.get('/api/admin-ui/resources/flatpages/flatpage/')

		self.assertEqual(response.status_code, 403)


class TeacherProfileUrlTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)

	def test_social_urls_can_be_left_blank(self):
		response = self.client.patch(f'/api/teacher/{self.teacher.id}/', {
			'face_url': '',
			'insta_url': '',
			'twit_url': '',
			'web_url': '',
			'you_url': '',
		}, format='multipart')

		self.assertEqual(response.status_code, 200, response.data)

	def test_social_url_without_scheme_is_normalized(self):
		response = self.client.patch(f'/api/teacher/{self.teacher.id}/', {
			'face_url': 'facebook.com/ada',
		}, format='multipart')

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data['face_url'], 'https://facebook.com/ada')


class CategoryApiTests(TestCase):
	def test_category_endpoint_lists_categories_for_course_form(self):
		category = CourseCategory.objects.create(
			title='Web Development',
			description='Frontend and backend development',
		)

		response = APIClient().get('/api/category/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]['id'], category.id)
		self.assertEqual(response.data[0]['title'], 'Web Development')


class TeacherManagementApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = CourseCategory.objects.create(
			title='Programming', description='Programming courses')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			password='student-password',
			username='grace',
			interseted_categories='Programming',
		)
		self.course = Course.objects.create(
			category=self.category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python',
		)
		StudentCourseEnrollment.objects.create(course=self.course, student=self.student)

	def test_teacher_course_endpoint_lists_owned_courses(self):
		response = self.client.get(f'/api/teacher-course/{self.teacher.id}')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]['id'], self.course.id)

	def test_teacher_students_endpoint_lists_enrolled_students(self):
		response = self.client.get(f'/api/fetch-all-enrolled-students/{self.teacher.id}')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]['student']['id'], self.student.id)


class EnrollmentApprovalTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = CourseCategory.objects.create(
			title='Programming', description='Programming courses')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Computer science',
			mobile_no='1234567890',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			password='student-password',
			username='grace',
			interseted_categories='Programming',
		)
		self.course = Course.objects.create(
			category=self.category,
			teacher=self.teacher,
			title='Python',
			description='Learn Python',
		)

	def test_student_enrollment_creates_pending_request_once(self):
		data = {'course': self.course.id, 'student': self.student.id}
		first_response = self.client.post('/api/student-enroll-course/', data, format='multipart')
		second_response = self.client.post('/api/student-enroll-course/', data, format='multipart')

		self.assertEqual(first_response.status_code, 201)
		self.assertEqual(second_response.status_code, 200)
		self.assertEqual(first_response.data['status'], StudentCourseEnrollment.STATUS_PENDING)
		self.assertEqual(StudentCourseEnrollment.objects.count(), 1)

	def test_teacher_can_approve_one_or_all_pending_requests(self):
		first_request = StudentCourseEnrollment.objects.create(course=self.course, student=self.student)
		response = self.client.post(
			f'/api/teacher/{self.teacher.id}/enrollment/{first_request.id}/approve/')

		self.assertEqual(response.status_code, 200)
		first_request.refresh_from_db()
		self.assertEqual(first_request.status, StudentCourseEnrollment.STATUS_APPROVED)
		student_notification = Notification.objects.get(student=self.student)
		self.assertEqual(student_notification.subject, 'Demande approuvée')
		self.assertIn(self.course.title, student_notification.message)
		notifications_response = self.client.get(f'/api/notifications/student/{self.student.pk}/')
		self.assertEqual(notifications_response.status_code, 200)
		self.assertEqual(notifications_response.data[0]['id'], student_notification.pk)
		self.assertEqual(notifications_response.data[0]['link'], f'/detail/{self.course.pk}')

		second_student = Student.objects.create(
			fullname='Katherine Johnson',
			email='katherine@example.com',
			username='katherine',
			interseted_categories='Programming',
		)
		StudentCourseEnrollment.objects.create(course=self.course, student=second_student)
		response = self.client.post(f'/api/teacher/{self.teacher.id}/enrollment/approve-all/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['approved_count'], 1)
		self.assertTrue(Notification.objects.filter(student=second_student, subject='Demande approuvée').exists())


class GroupMessagingAndAssignmentTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		category = CourseCategory.objects.create(title='Programmation')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace',
			email='ada@example.com',
			qualification='Informatique',
			mobile_no='1234567890',
		)
		self.student = Student.objects.create(
			fullname='Grace Hopper',
			email='grace@example.com',
			username='grace',
			interseted_categories='Programmation',
		)
		self.other_student = Student.objects.create(
			fullname='Katherine Johnson',
			email='katherine@example.com',
			username='katherine',
			interseted_categories='Programmation',
		)
		self.group = LearningGroup.objects.create(name='Python avancé')
		GroupMembership.objects.create(group=self.group, teacher=self.teacher)
		GroupMembership.objects.create(group=self.group, student=self.student)

	def test_only_group_members_can_read_and_send_messages(self):
		student_groups = self.client.get(f'/api/groups/?student_id={self.student.pk}')
		self.assertEqual(student_groups.status_code, 200)
		self.assertEqual(student_groups.data[0]['name'], 'Python avancé')

		send_response = self.client.post(
			f'/api/groups/{self.group.pk}/messages/',
			{'student_id': self.student.pk, 'message': 'Bonjour au groupe'},
			format='json',
		)
		self.assertEqual(send_response.status_code, 201, send_response.data)
		self.assertEqual(GroupMessage.objects.count(), 1)
		self.assertTrue(Notification.objects.filter(teacher=self.teacher, subject__contains='Python avancé').exists())

		outsider_response = self.client.post(
			f'/api/groups/{self.group.pk}/messages/',
			{'student_id': self.other_student.pk, 'message': 'Message interdit'},
			format='json',
		)
		self.assertEqual(outsider_response.status_code, 404)
		self.assertEqual(GroupMessage.objects.count(), 1)

	def test_teacher_can_send_group_assignment_to_students_only_with_notifications(self):
		GroupMembership.objects.create(group=self.group, student=self.other_student)
		response = self.client.post(
			f'/api/groups/{self.group.pk}/assignments/',
			{
				'teacher_id': self.teacher.pk,
				'title': 'Exercice Python',
				'detail': 'Créer une fonction.',
			},
			format='json',
		)
		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data['created'], 2)
		assignments = StudentAssignment.objects.filter(group=self.group)
		self.assertEqual(set(assignments.values_list('student_id', flat=True)), {self.student.pk, self.other_student.pk})
		self.assertTrue(Notification.objects.filter(student=self.student, subject='Nouveau devoir reçu').exists())
		self.assertFalse(Notification.objects.filter(teacher=self.teacher, subject='Nouveau devoir reçu').exists())

	def test_teacher_group_message_notifies_all_student_members(self):
		GroupMembership.objects.create(group=self.group, student=self.other_student)
		response = self.client.post(
			f'/api/groups/{self.group.pk}/messages/',
			{'teacher_id': self.teacher.pk, 'message': 'Consultez les nouvelles ressources.'},
			format='json',
		)

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(
			Notification.objects.filter(
				student__in=[self.student, self.other_student],
				subject__contains='Python avancé',
			).count(),
			2,
		)

	def test_student_cannot_assign_a_group_homework(self):
		response = self.client.post(
			f'/api/groups/{self.group.pk}/assignments/',
			{'student_id': self.student.pk, 'title': 'Devoir', 'detail': 'Consigne'},
			format='json',
		)
		self.assertEqual(response.status_code, 403)
		self.assertEqual(StudentAssignment.objects.count(), 0)


class StudentStudyMaterialAccessTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		category = CourseCategory.objects.create(title='Docs', description='Documents')
		teacher = Teacher.objects.create(
			full_name='Ada Lovelace', email='ada@example.com',
			qualification='Computer science', mobile_no='1234567890')
		self.student = Student.objects.create(
			fullname='Grace Hopper', email='grace@example.com', username='grace',
			interseted_categories='Docs')
		self.course = Course.objects.create(
			category=category, teacher=teacher, title='Documents', description='Course files')
		self.enrollment = StudentCourseEnrollment.objects.create(
			course=self.course, student=self.student)
		StudyMaterial.objects.create(
			course=self.course, title='Guide', description='PDF guide',
			upload='study_materials/guide.pdf')
		StudyMaterial.objects.create(
			course=self.course, title='Video', description='Must not be listed',
			upload='study_materials/lesson.mp4')

	def test_pending_student_cannot_view_course_materials(self):
		response = self.client.get(
			f'/api/user/study-material/{self.course.id}/{self.student.id}')

		self.assertEqual(response.status_code, 403)

	def test_approved_student_sees_documents_but_not_video_files(self):
		self.enrollment.status = StudentCourseEnrollment.STATUS_APPROVED
		self.enrollment.save(update_fields=['status'])
		response = self.client.get(
			f'/api/user/study-material/{self.course.id}/{self.student.id}')

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item['title'] for item in response.data], ['Guide'])

	def test_teacher_cannot_upload_video_as_study_material(self):
		teacher_id = self.course.teacher_id
		response = self.client.post(
			f'/api/study-material/{self.course.id}/{teacher_id}',
			{
				'course': self.course.id,
				'title': 'Lesson video',
				'description': 'Video file',
				'upload': SimpleUploadedFile('lesson.mp4', b'video', content_type='video/mp4'),
			},
			format='multipart',
		)

		self.assertEqual(response.status_code, 400)


class NotificationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = CourseCategory.objects.create(title='Programming', description='Courses')
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace', email='ada@example.com',
			qualification='Computer science', mobile_no='1234567890')
		self.student = Student.objects.create(
			fullname='Grace Hopper', email='grace@example.com', username='grace',
			interseted_categories='Programming')
		self.course = Course.objects.create(
			category=self.category, teacher=self.teacher,
			title='Python', description='Learn Python')

	def test_enrollment_request_notifies_teacher_with_request_link(self):
		response = self.client.post('/api/student-enroll-course/', {
			'course': self.course.id,
			'student': self.student.id,
		}, format='multipart')

		self.assertEqual(response.status_code, 201)
		notification = Notification.objects.get(teacher=self.teacher)
		self.assertIn(f'request_id={response.data["id"]}', notification.link)

	def test_incoming_message_notifies_the_other_participant(self):
		response = self.client.post(
			f'/api/send-message/{self.teacher.id}/{self.student.id}',
			{'msg_to': 'Bonjour', 'msg_from': 'teacher'},
			format='multipart',
		)

		self.assertEqual(response.status_code, 200)
		notification = Notification.objects.get(student=self.student)
		self.assertIn(f'teacher_id={self.teacher.id}', notification.link)

	def test_assigned_course_homework_notifies_the_student(self):
		response = self.client.post(
			f'/api/student-assignment/{self.teacher.id}/{self.student.id}',
			{
				'teacher': self.teacher.id,
				'student': self.student.id,
				'title': 'Exercice',
				'detail': 'Réaliser l’exercice.',
			},
			format='multipart',
		)

		self.assertEqual(response.status_code, 201, response.data)
		notification = Notification.objects.get(student=self.student, subject='Nouveau devoir reçu')
		self.assertEqual(notification.link, '/my-assignments')

	def test_notification_list_and_read_endpoint_are_recipient_scoped(self):
		notification = Notification.objects.create(
			teacher=self.teacher,
			subject='Message reçu',
			message='Bonjour',
			link=f'/my-users?student_id={self.student.id}',
		)

		response = self.client.get(f'/api/notifications/teacher/{self.teacher.id}/')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]['id'], notification.id)

		response = self.client.post(
			f'/api/notifications/teacher/{self.teacher.id}/{notification.id}/read/')
		self.assertEqual(response.status_code, 200)
		notification.refresh_from_db()
		self.assertTrue(notification.is_read)


class ChatMessageManagementTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.teacher = Teacher.objects.create(
			full_name='Ada Lovelace', email='ada@example.com',
			qualification='Computer science', mobile_no='1234567890')
		self.student = Student.objects.create(
			fullname='Grace Hopper', email='grace@example.com', username='grace',
			interseted_categories='Programming')

	def test_opening_chat_marks_received_messages_read_and_returns_sender_profile(self):
		message = TeacherStudentChat.objects.create(
			teacher=self.teacher, student=self.student,
			msg_from='student', msg_to='Bonjour')

		response = self.client.get(
			f'/api/get-message/{self.teacher.id}/{self.student.id}?viewer=teacher')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0]['sender_name'], self.student.fullname)
		self.assertEqual(response.data[0]['is_read'], True)
		message.refresh_from_db()
		self.assertTrue(message.is_read)

	def test_author_can_edit_and_delete_own_message(self):
		message = TeacherStudentChat.objects.create(
			teacher=self.teacher, student=self.student,
			msg_from='teacher', msg_to='Ancien message')

		response = self.client.patch(
			f'/api/message/{message.id}/teacher/', {'msg_to': 'Message corrigé'}, format='json')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['msg_to'], 'Message corrigé')
		self.assertIsNotNone(response.data['edited_at'])

		response = self.client.delete(f'/api/message/{message.id}/teacher/')
		self.assertEqual(response.status_code, 204)
		self.assertFalse(TeacherStudentChat.objects.filter(pk=message.id).exists())

	def test_user_cannot_edit_another_participants_message(self):
		message = TeacherStudentChat.objects.create(
			teacher=self.teacher, student=self.student,
			msg_from='student', msg_to='Message étudiant')

		response = self.client.patch(
			f'/api/message/{message.id}/teacher/', {'msg_to': 'Tentative'}, format='json')

		self.assertEqual(response.status_code, 403)
