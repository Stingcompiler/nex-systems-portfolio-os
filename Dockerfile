FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements/ backend/requirements/
RUN pip install --no-cache-dir -r backend/requirements/prod.txt

COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci

COPY . .

ARG NEXT_PUBLIC_SITE_URL=https://stingdev.pro
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    INTERNAL_API_URL=http://127.0.0.1:8000/api/v1 \
    BACKEND_ORIGIN=http://127.0.0.1:8000

RUN cd frontend && npm run build

RUN cd backend && SECRET_KEY=build-only-key DJANGO_SETTINGS_MODULE=config.settings.prod \
    python manage.py collectstatic --noinput 2>/dev/null || true

RUN chmod +x start.sh

CMD ["./start.sh"]
