"""Google sign-in for learners (OAuth 2.0 authorization code flow).

1. ``/api/auth/google/start/`` redirects the browser to Google with a signed
   ``state`` tied to a short-lived cookie.
2. Google redirects to ``/api/auth/callback/google``; the backend exchanges the
   code, reads the verified e-mail and finds or creates the learner.
3. The browser lands on ``/auth/google/complete`` with a short-lived signed
   token that the React app exchanges for the learner id.
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


class GoogleAuthError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def is_configured():
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


def _safe_next(value):
    value = str(value or '')
    return value if value.startswith('/') and not value.startswith('//') else '/user-dashboard'


def _fail(code):
    return redirect(f'/user-register?{urlencode({"google": code})}')


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


def _student_for_google_profile(profile):
    email = str(profile.get('email') or '').strip().lower()
    if not email or not profile.get('email_verified'):
        raise GoogleAuthError('unverified')
    student = models.Student.objects.filter(email__iexact=email).first()
    if student is None:
        approved = settings.GOOGLE_AUTO_APPROVE_STUDENTS
        student = models.Student.objects.create(
            fullname=str(profile.get('name') or email.split('@')[0])[:100],
            email=email,
            username=email.split('@')[0][:500],
            password=None,
            interseted_categories='',
            is_active=approved,
            is_approved=approved,
        )
    if not student.is_approved:
        raise GoogleAuthError('pending')
    if not student.is_active:
        raise GoogleAuthError('blocked')
    return student


@require_GET
def google_start(request):
    if not is_configured():
        return _fail('unavailable')
    nonce = secrets.token_urlsafe(24)
    state = signing.dumps({'nonce': nonce, 'next': _safe_next(request.GET.get('next'))}, salt=STATE_SALT)
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
    try:
        if request.GET.get('error'):
            raise GoogleAuthError('cancelled')
        try:
            state = signing.loads(request.GET.get('state', ''), salt=STATE_SALT, max_age=STATE_MAX_AGE)
        except signing.BadSignature:
            raise GoogleAuthError('expired')
        if not nonce_cookie or not secrets.compare_digest(nonce_cookie, state.get('nonce', '')):
            raise GoogleAuthError('expired')
        code = request.GET.get('code')
        if not code:
            raise GoogleAuthError('failed')
        student = _student_for_google_profile(_fetch_userinfo(_exchange_code(code)))
    except GoogleAuthError as error:
        response = _fail(error.code)
    except (httpx.HTTPError, KeyError, ValueError):
        logger.exception('Google sign-in failed')
        response = _fail('failed')
    else:
        token = signing.dumps({'student_id': student.pk}, salt=LOGIN_SALT)
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
        student = models.Student.objects.filter(pk=payload.get('student_id'), is_active=True, is_approved=True).first()
        if student is None:
            return Response({'detail': 'Ce compte n’est pas encore activé.'}, status=403)
        return Response({'student_id': student.pk, 'fullname': student.fullname})
