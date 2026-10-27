"""Google sign-in for learners and trainers (OAuth 2.0 authorization code flow).

1. ``/api/auth/google/start/?role=student|teacher`` redirects the browser to
   Google with a signed ``state`` (role + next page) tied to a short-lived cookie.
2. Google redirects to ``/api/auth/callback/google``; the backend exchanges the
   code, reads the verified e-mail and finds or creates the learner or trainer.
3. The browser lands on ``/auth/google/complete`` with a short-lived signed
   token that the React app exchanges for the account id.
"""
import logging
import secrets
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.core import signing
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models

logger = logging.getLogger(__name__)

AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
STATE_SALT = 'main.google.state'
LOGIN_SALT = 'main.google.login'
NONCE_COOKIE = 'tcid_google_nonce'
STATE_MAX_AGE = 10 * 60
LOGIN_TOKEN_MAX_AGE = 5 * 60
ROLES = {
    'student': {'model': models.Student, 'home': '/user-dashboard', 'entry': '/user-register'},
    'teacher': {'model': models.Teacher, 'home': '/teacher-dashboard', 'entry': '/teacher-login'},
}


class GoogleAuthError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def is_configured():
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


def _role(value):
    return value if value in ROLES else 'student'


def _safe_next(value, role):
    value = str(value or '')
    return value if value.startswith('/') and not value.startswith('//') else ROLES[role]['home']


def _fail(code, role):
    return redirect(f'{ROLES[role]["entry"]}?{urlencode({"google": code})}')


def _exchange_code(code):
    response = httpx.post(TOKEN_URL, data={
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'grant_type': 'authorization_code',
    }, timeout=10)
    if response.status_code != 200:
        logger.warning('Google token exchange failed: %s %s', response.status_code, response.text[:300])
        raise GoogleAuthError('failed')
    return response.json()['access_token']


def _fetch_userinfo(access_token):
    response = httpx.get(USERINFO_URL, headers={'Authorization': f'Bearer {access_token}'}, timeout=10)
    if response.status_code != 200:
        raise GoogleAuthError('failed')
    return response.json()


def _verified_email(profile):
    email = str(profile.get('email') or '').strip().lower()
    if not email or not profile.get('email_verified'):
        raise GoogleAuthError('unverified')
    return email


def _display_name(profile, email):
    return str(profile.get('name') or email.split('@')[0])[:100]


def _check_account(account):
    if not account.is_approved:
        raise GoogleAuthError('pending')
    if not account.is_active:
        raise GoogleAuthError('blocked')
    return account


def _student_for_google_profile(profile):
    email = _verified_email(profile)
    student = models.Student.objects.filter(email__iexact=email).first()
    if student is None:
        approved = settings.GOOGLE_AUTO_APPROVE_STUDENTS
        student = models.Student.objects.create(
            fullname=_display_name(profile, email),
            email=email,
            username=email.split('@')[0][:500],
            password=None,
            interseted_categories='',
            is_active=approved,
            is_approved=approved,
        )
    return _check_account(student)


def _teacher_for_google_profile(profile):
    """New trainers always wait for administrator approval, as with the form."""
    email = _verified_email(profile)
    teacher = models.Teacher.objects.filter(email__iexact=email).first()
    if teacher is None:
        teacher = models.Teacher.objects.create(
            full_name=_display_name(profile, email),
            email=email,
            password=None,
            qualification='',
            mobile_no='',
            is_active=False,
            is_approved=False,
        )
    return _check_account(teacher)


@require_GET
def google_start(request):
    role = _role(request.GET.get('role'))
    if not is_configured():
        return _fail('unavailable', role)
    nonce = secrets.token_urlsafe(24)
    state = signing.dumps(
        {'nonce': nonce, 'role': role, 'next': _safe_next(request.GET.get('next'), role)},
        salt=STATE_SALT,
    )
    params = {
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'prompt': 'select_account',
        'access_type': 'online',
    }
    response = redirect(f'{AUTHORIZE_URL}?{urlencode(params)}')
    response.set_cookie(
        NONCE_COOKIE, nonce, max_age=STATE_MAX_AGE, httponly=True,
        secure=request.is_secure(), samesite='Lax', path='/api/auth/',
    )
    return response


@require_GET
def google_callback(request):
    nonce_cookie = request.COOKIES.get(NONCE_COOKIE, '')
    role = 'student'
    try:
        try:
            state = signing.loads(request.GET.get('state', ''), salt=STATE_SALT, max_age=STATE_MAX_AGE)
        except signing.BadSignature:
            raise GoogleAuthError('expired')
        role = _role(state.get('role'))
        if request.GET.get('error'):
            raise GoogleAuthError('cancelled')
        if not nonce_cookie or not secrets.compare_digest(nonce_cookie, state.get('nonce', '')):
            raise GoogleAuthError('expired')
        code = request.GET.get('code')
        if not code:
            raise GoogleAuthError('failed')
        profile = _fetch_userinfo(_exchange_code(code))
        if role == 'teacher':
            account = _teacher_for_google_profile(profile)
        else:
            account = _student_for_google_profile(profile)
    except GoogleAuthError as error:
        response = _fail(error.code, role)
    except (httpx.HTTPError, KeyError, ValueError):
        logger.exception('Google sign-in failed')
        response = _fail('failed', role)
    else:
        token = signing.dumps({'role': role, 'id': account.pk}, salt=LOGIN_SALT)
        response = redirect(f'/auth/google/complete#{urlencode({"token": token, "next": state["next"]})}')
    response.delete_cookie(NONCE_COOKIE, path='/api/auth/')
    return response


class GoogleConfigView(APIView):
    def get(self, request):
        return Response({'enabled': is_configured()})


class GoogleLoginExchangeView(APIView):
    def post(self, request):
        try:
            payload = signing.loads(str(request.data.get('token', '')), salt=LOGIN_SALT, max_age=LOGIN_TOKEN_MAX_AGE)
        except signing.BadSignature:
            return Response({'detail': 'La connexion Google a expiré. Recommencez.'}, status=400)
        role = _role(payload.get('role'))
        account = ROLES[role]['model'].objects.filter(pk=payload.get('id'), is_active=True, is_approved=True).first()
        if account is None:
            return Response({'detail': 'Ce compte n’est pas encore activé.'}, status=403)
        if role == 'teacher':
            return Response({'role': role, 'teacher_id': account.pk, 'fullname': account.full_name})
        return Response({'role': role, 'student_id': account.pk, 'fullname': account.fullname})
