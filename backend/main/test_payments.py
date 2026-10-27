import json
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    Chapter, ChapterDocument, Course, CourseCategory, CoursePayment, Notification,
    Student, StudentCourseEnrollment, Teacher,
)


class PaidCourseFixture(TestCase):
    def setUp(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        media_override = override_settings(MEDIA_ROOT=media_root)
        media_override.enable()
        self.addCleanup(media_override.disable)
        self.client = APIClient()
        category = CourseCategory.objects.create(title='Code', description='Programmation')
        self.teacher = Teacher.objects.create(
            full_name='Ada Lovelace', email='ada@example.com',
            qualification='Informatique', mobile_no='0340000000')
        self.student = Student.objects.create(
            fullname='Grace Hopper', email='grace@example.com', username='grace',
            interseted_categories='Code')
        self.course = Course.objects.create(
            category=category, teacher=self.teacher, title='Python pro',
            description='Cours payant', price=25000)
        self.first = Chapter.objects.create(
            course=self.course, title='Introduction', description='<p>Bienvenue</p>',
            video='chapter_videos/intro.mp4', position=1)
        self.second = Chapter.objects.create(
            course=self.course, title='Variables', description='<p>Suite</p>',
            video='chapter_videos/variables.mp4', position=2)
        ChapterDocument.objects.create(chapter=self.first, title='Fiche', upload='chapter_documents/fiche.pdf')
        ChapterDocument.objects.create(chapter=self.second, title='Exercices', upload='chapter_documents/ex.pdf')
        self.admin = get_user_model().objects.create_user('admin', 'admin@example.com', 'admin-pass', is_staff=True, is_superuser=True)

    def submit(self, reference='64494665', amount=25000, method='mvola'):
        return self.client.post(f'/api/courses/{self.course.pk}/payments/', {
            'student_id': self.student.pk,
            'method': method,
            'amount': amount,
            'reference': reference,
        }, format='json')

    def admin_client(self):
        client = APIClient(enforce_csrf_checks=False)
        client.force_login(self.admin)
        return client


class ChapterAccessTests(PaidCourseFixture):
    def test_first_chapter_is_free_and_next_ones_are_locked(self):
        response = self.client.get(f'/api/course-chapters/{self.course.pk}', {'student_id': self.student.pk})

        self.assertEqual(response.status_code, 200)
        first, second = response.data
        self.assertTrue(first['is_free'])
        self.assertFalse(first['is_locked'])
        self.assertTrue(first['video'])
        self.assertEqual([doc['title'] for doc in first['documents']], ['Fiche'])
        self.assertTrue(second['is_locked'])
        self.assertIsNone(second['video'])
        self.assertEqual(second['documents'], [])

    def test_course_detail_outline_never_exposes_video_urls(self):
        response = self.client.get(f'/api/course/{self.course.pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['price'], 25000)
        self.assertTrue(response.data['is_paid'])
        outline = response.data['course_chapters']
        self.assertEqual([item['is_locked'] for item in outline], [False, True])
        self.assertNotIn('video', outline[0])
        self.assertNotIn('password', response.data['teacher'])

    def test_locked_chapter_documents_are_refused(self):
        response = self.client.get(f'/api/chapter/{self.second.pk}/documents/', {'student_id': self.student.pk})
        self.assertEqual(response.status_code, 403)

    def test_teacher_sees_everything_and_only_owner_can_edit(self):
        response = self.client.get(f'/api/course-chapters/{self.course.pk}', {'teacher_id': self.teacher.pk})
        self.assertFalse(response.data[1]['is_locked'])

        other = Teacher.objects.create(full_name='Other', email='o@example.com', qualification='x', mobile_no='1')
        refused = self.client.patch(f'/api/chapter/{self.second.pk}?teacher_id={other.pk}', {'title': 'Pirate'}, format='json')
        self.assertEqual(refused.status_code, 403)
        allowed = self.client.patch(
            f'/api/chapter/{self.second.pk}?teacher_id={self.teacher.pk}',
            {'title': 'Variables', 'description': '<p><strong>Gras</strong><script>x</script></p>', 'is_free_preview': True},
            format='json')
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.second.refresh_from_db()
        self.assertTrue(self.second.is_free_preview)
        self.assertNotIn('<script>', self.second.description)

    def test_teacher_adds_several_documents_to_a_chapter(self):
        url = f'/api/chapter/{self.second.pk}/documents/?teacher_id={self.teacher.pk}'
        for name in ('cours.txt', 'annexe.docx'):
            response = self.client.post(url, {
                'title': name,
                'description': '<ul><li>Point 1</li></ul>',
                'upload': SimpleUploadedFile(name, b'data', content_type='application/octet-stream'),
            }, format='multipart')
            self.assertEqual(response.status_code, 201, response.data)
        video = self.client.post(url, {
            'title': 'video',
            'upload': SimpleUploadedFile('lesson.mp4', b'v', content_type='video/mp4'),
        }, format='multipart')
        self.assertEqual(video.status_code, 400)
        self.assertEqual(self.second.documents.count(), 3)

    def test_teacher_reorders_chapters(self):
        url = f'/api/course-chapters/{self.course.pk}/reorder/?teacher_id={self.teacher.pk}'
        response = self.client.post(url, {'chapter_ids': [self.second.pk, self.first.pk]}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.course.first_chapter_id(), self.second.pk)


class PaymentFlowTests(PaidCourseFixture):
    def test_payment_methods_list_the_three_mobile_money_accounts(self):
        response = self.client.get('/api/payment-methods/')

        self.assertEqual([item['number'] for item in response.data], ['0379069983', '0332354093', '0342534546'])
        self.assertTrue(all(item['holder'] == 'Alex Fare' for item in response.data))

    def test_student_payment_requires_reference_and_full_amount(self):
        self.assertEqual(self.submit(reference='12').status_code, 400)
        self.assertEqual(self.submit(amount=1000).status_code, 400)
        response = self.submit(reference=' 6449 4665 ')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['reference'], '64494665')
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(self.submit(reference='99999999').status_code, 409)

    def test_paid_course_cannot_be_unlocked_by_enrollment_request_or_teacher(self):
        response = self.client.post('/api/student-enroll-course/', {
            'course': self.course.pk, 'student': self.student.pk}, format='multipart')
        self.assertEqual(response.status_code, 400)

        enrollment = StudentCourseEnrollment.objects.create(course=self.course, student=self.student)
        response = self.client.post(f'/api/teacher/{self.teacher.pk}/enrollment/{enrollment.pk}/approve/')
        self.assertEqual(response.status_code, 409)

    def test_admin_validates_only_with_the_same_reference(self):
        payment_id = self.submit().data['id']
        admin = self.admin_client()
        wrong = admin.post(f'/api/admin-ui/payments/{payment_id}/validate/',
                           data=json.dumps({'reference': '11111111', 'amount_received': 25000}),
                           content_type='application/json')
        self.assertEqual(wrong.status_code, 400)

        ok = admin.post(f'/api/admin-ui/payments/{payment_id}/validate/',
                        data=json.dumps({'reference': '64494665', 'amount_received': 25000}),
                        content_type='application/json')
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(CoursePayment.objects.get(pk=payment_id).status, 'validated')
        self.assertTrue(StudentCourseEnrollment.objects.filter(
            course=self.course, student=self.student, status='approved').exists())
        self.assertTrue(Notification.objects.filter(teacher=self.teacher, subject='Nouvel apprenant inscrit').exists())

        chapters = self.client.get(f'/api/course-chapters/{self.course.pk}', {'student_id': self.student.pk}).data
        self.assertFalse(chapters[1]['is_locked'])
        self.assertEqual(admin.post(f'/api/admin-ui/payments/{payment_id}/validate/',
                                    data=json.dumps({'reference': '64494665', 'amount_received': 25000}),
                                    content_type='application/json').status_code, 409)

    def test_admin_rejects_with_reason_and_reference_becomes_reusable(self):
        payment_id = self.submit().data['id']
        admin = self.admin_client()
        response = admin.post(f'/api/admin-ui/payments/{payment_id}/reject/',
                              data=json.dumps({'note': 'Référence introuvable'}),
                              content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.submit().status_code, 201)

    def test_only_staff_can_list_or_validate_payments(self):
        payment_id = self.submit().data['id']
        self.assertEqual(self.client.get('/api/admin-ui/payments/').status_code, 401)
        self.assertEqual(self.client.post(f'/api/admin-ui/payments/{payment_id}/validate/').status_code, 401)
        listing = self.admin_client().get('/api/admin-ui/payments/')
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()['counts']['pending'], 1)
        self.assertEqual(listing.json()['results'][0]['course_title'], 'Python pro')

    def test_teacher_and_student_see_their_payment_history(self):
        self.submit()
        student_history = self.client.get(f'/api/student/{self.student.pk}/payments/')
        self.assertEqual(student_history.data[0]['status'], 'pending')
        teacher_history = self.client.get(f'/api/teacher/{self.teacher.pk}/payments/')
        self.assertEqual(teacher_history.data['pending_count'], 1)
        self.assertEqual(teacher_history.data['revenue'], 0)


class PasswordSecurityTests(TestCase):
    def test_registration_hashes_password_and_login_still_works(self):
        client = APIClient()
        response = client.post('/api/student/', {
            'fullname': 'Grace', 'email': 'grace@example.com', 'password': 'secret-pass',
            'username': 'grace', 'interseted_categories': 'Code',
        }, format='multipart')
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('password', response.data)
        student = Student.objects.get(email='grace@example.com')
        self.assertNotEqual(student.password, 'secret-pass')
        Student.objects.filter(pk=student.pk).update(is_active=True, is_approved=True)
        login = client.post('/api/student-login', {'email': 'grace@example.com', 'password': 'secret-pass'}, format='multipart')
        self.assertEqual(login.json(), {'bool': True, 'student_id': student.pk})

    def test_legacy_plain_text_password_is_upgraded_on_login(self):
        teacher = Teacher.objects.create(
            full_name='Ada', email='ada@example.com', password='legacy-pass',
            qualification='x', mobile_no='1')
        response = APIClient().post('/api/teacher-login', {'email': 'ada@example.com', 'password': 'legacy-pass'}, format='multipart')
        self.assertTrue(response.json()['bool'])
        teacher.refresh_from_db()
        self.assertTrue(teacher.password.startswith('pbkdf2_'))


@override_settings(JITSI_DOMAIN='meet.example.com', JITSI_JWT_SECRET='jitsi-secret-for-tests-0123456789abcdef')
class LiveJitsiTokenTests(PaidCourseFixture):
    def join(self, **identity):
        from .models import LiveClassroom
        classroom, _ = LiveClassroom.objects.get_or_create(
            course=self.course, title='Live', defaults={'status': LiveClassroom.STATUS_LIVE})
        return self.client.post(f'/api/live-classrooms/{classroom.pk}/join/', identity, format='json')

    def test_teacher_token_is_moderator_and_bound_to_the_room(self):
        import jwt
        response = self.join(teacher_id=self.teacher.pk)

        self.assertEqual(response.status_code, 200)
        config = response.data['jitsi']
        self.assertEqual(config['domain'], 'meet.example.com')
        claims = jwt.decode(config['jwt'], 'jitsi-secret-for-tests-0123456789abcdef', algorithms=['HS256'], audience='jitsi')
        self.assertEqual(claims['room'], config['room'])
        self.assertEqual(claims['iss'], 'tcid-center')
        self.assertTrue(claims['context']['user']['moderator'])
        self.assertEqual(claims['context']['user']['affiliation'], 'owner')

    def test_paid_student_gets_member_token_and_unpaid_student_is_refused(self):
        import jwt
        self.assertEqual(self.join(student_id=self.student.pk).status_code, 403)
        StudentCourseEnrollment.objects.create(course=self.course, student=self.student, status='approved')
        response = self.join(student_id=self.student.pk)
        claims = jwt.decode(response.data['jitsi']['jwt'], 'jitsi-secret-for-tests-0123456789abcdef', algorithms=['HS256'], audience='jitsi')
        self.assertFalse(claims['context']['user']['moderator'])
        self.assertEqual(claims['context']['user']['affiliation'], 'member')

    @override_settings(JITSI_DOMAIN='')
    def test_join_reports_missing_jitsi_configuration(self):
        response = self.join(teacher_id=self.teacher.pk)
        self.assertIsNone(response.data['jitsi'])


class AdminSessionDoesNotBreakPublicApiTests(PaidCourseFixture):
    def test_post_succeeds_when_admin_session_cookie_is_present(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.admin)
        response = client.post(f'/api/courses/{self.course.pk}/payments/', {
            'student_id': self.student.pk, 'method': 'mvola', 'amount': 25000, 'reference': '77778888',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)


@override_settings(GOOGLE_OAUTH_CLIENT_ID='client-id', GOOGLE_OAUTH_CLIENT_SECRET='client-secret',
                   GOOGLE_OAUTH_REDIRECT_URI='https://tcid.test/api/auth/callback/google')
class GoogleSignInTests(TestCase):
    def start(self, client, role=None):
        from urllib.parse import parse_qs, urlparse
        params = {'next': '/detail/3'}
        if role:
            params['role'] = role
        response = client.get('/api/auth/google/start/', params)
        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlparse(response['Location']).query)
        self.assertEqual(query['redirect_uri'], ['https://tcid.test/api/auth/callback/google'])
        return query['state'][0]

    def callback(self, client, state, profile):
        from unittest.mock import patch
        with patch('main.google_auth._exchange_code', return_value='access'), \
                patch('main.google_auth._fetch_userinfo', return_value=profile):
            return client.get('/api/auth/callback/google', {'code': 'abc', 'state': state})

    def test_existing_approved_learner_signs_in_and_gets_their_id(self):
        from urllib.parse import parse_qs, urlparse
        student = Student.objects.create(fullname='Grace', email='grace@example.com', username='grace',
                                         interseted_categories='', is_active=True, is_approved=True)
        client = APIClient()
        response = self.callback(client, self.start(client), {'email': 'Grace@Example.com', 'email_verified': True})

        self.assertEqual(response.status_code, 302)
        fragment = parse_qs(urlparse(response['Location']).fragment)
        self.assertTrue(response['Location'].startswith('/auth/google/complete#'))
        self.assertEqual(fragment['next'], ['/detail/3'])
        exchange = client.post('/api/auth/google/exchange/', {'token': fragment['token'][0]}, format='json')
        self.assertEqual(exchange.data['student_id'], student.pk)

    def test_new_google_learner_waits_for_admin_approval(self):
        client = APIClient()
        response = self.callback(client, self.start(client), {'email': 'new@example.com', 'email_verified': True, 'name': 'Rasoa'})

        self.assertEqual(response['Location'], '/user-register?google=pending')
        student = Student.objects.get(email='new@example.com')
        self.assertFalse(student.is_approved)
        self.assertEqual(student.fullname, 'Rasoa')

    def test_state_without_matching_cookie_is_rejected(self):
        client = APIClient()
        state = self.start(client)
        response = self.callback(APIClient(), state, {'email': 'x@example.com', 'email_verified': True})
        self.assertEqual(response['Location'], '/user-register?google=expired')
        self.assertFalse(Student.objects.filter(email='x@example.com').exists())

    def test_unverified_email_and_forged_exchange_token_are_refused(self):
        client = APIClient()
        response = self.callback(client, self.start(client), {'email': 'y@example.com', 'email_verified': False})
        self.assertEqual(response['Location'], '/user-register?google=unverified')
        self.assertEqual(client.post('/api/auth/google/exchange/', {'token': 'forged'}, format='json').status_code, 400)

    def test_existing_approved_trainer_signs_in_and_gets_teacher_id(self):
        from urllib.parse import parse_qs, urlparse
        teacher = Teacher.objects.create(full_name='Hery', email='hery@example.com', qualification='', mobile_no='')
        Student.objects.create(fullname='Same', email='hery@example.com', username='same',
                               interseted_categories='', is_active=True, is_approved=True)
        client = APIClient()
        response = self.callback(client, self.start(client, 'teacher'), {'email': 'hery@example.com', 'email_verified': True})

        fragment = parse_qs(urlparse(response['Location']).fragment)
        exchange = client.post('/api/auth/google/exchange/', {'token': fragment['token'][0]}, format='json')
        self.assertEqual(exchange.data['role'], 'teacher')
        self.assertEqual(exchange.data['teacher_id'], teacher.pk)
        self.assertNotIn('student_id', exchange.data)

    def test_new_google_trainer_waits_for_approval_on_trainer_page(self):
        client = APIClient()
        response = self.callback(client, self.start(client, 'teacher'), {'email': 'prof@example.com', 'email_verified': True, 'name': 'Rakoto'})

        self.assertEqual(response['Location'], '/teacher-login?google=pending')
        teacher = Teacher.objects.get(email='prof@example.com')
        self.assertFalse(teacher.is_approved)
        self.assertEqual(teacher.full_name, 'Rakoto')
        self.assertFalse(Student.objects.filter(email='prof@example.com').exists())
