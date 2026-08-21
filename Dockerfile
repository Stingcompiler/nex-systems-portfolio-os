FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y curl gnupg \
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

RUN chmod +x build-frontend.sh && ./build-frontend.sh

RUN cd backend && SECRET_KEY=build-only-key DJANGO_SETTINGS_MODULE=config.settings.prod \
    ALLOWED_HOSTS=localhost SECURE_SSL_REDIRECT=False \
    python manage.py collectstatic --noinput 2>/dev/null || true

RUN chmod +x start.sh

CMD ["./start.sh"]
