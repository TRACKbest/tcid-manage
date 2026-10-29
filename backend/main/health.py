"""Probe endpoints for Kubernetes.

``/api/healthz/`` (liveness) only proves the process answers, so a database
outage never makes Kubernetes restart healthy pods in a loop.
``/api/readyz/`` (readiness) also checks the database, so a pod that cannot
reach PostgreSQL stops receiving traffic until it can.
"""
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def healthz(request):
    return JsonResponse({'status': 'ok'})


@require_GET
def readyz(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:  # any database error means "not ready"
        return JsonResponse({'status': 'database unavailable'}, status=503)
    return JsonResponse({'status': 'ok'})
