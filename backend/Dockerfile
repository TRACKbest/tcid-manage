FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 app \
    && mkdir -p /app/media /app/staticfiles \
    && chown -R app:app /app

COPY --chown=app:app . .

USER app
EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "lms_api.asgi:application"]
