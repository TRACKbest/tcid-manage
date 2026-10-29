FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG REACT_APP_API_URL=/api
ARG REACT_APP_SITE_URL=/
ENV REACT_APP_API_URL=${REACT_APP_API_URL} \
    REACT_APP_SITE_URL=${REACT_APP_SITE_URL}
RUN npm run build

# Unprivileged nginx (uid 101, port 8080): runs under the Kubernetes
# "restricted" Pod Security Standard.
FROM nginxinc/nginx-unprivileged:stable-alpine
# Pull Alpine security fixes published after the base image was built.
USER root
RUN apk upgrade --no-cache
USER 101
# Docker Compose defaults; Kubernetes overrides them with cluster FQDNs.
ENV NGINX_RESOLVER=127.0.0.11 \
    BACKEND_UPSTREAM=http://backend:8000 \
    JITSI_WEB_UPSTREAM=http://jitsi-web:8000 \
    JICOFO_UPSTREAM=http://jitsi-jicofo:8888
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
