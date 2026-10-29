#!/usr/bin/env bash
# Manual deployment to GKE: the same steps as the CI "Deploy to GKE" job.
# Useful for the first installation or if GitHub Actions is unavailable.
#
#   ./infra/deploy.sh build    # build + push images with Cloud Build (tag = HEAD commit)
#   ./infra/deploy.sh deploy   # sync secrets, apply manifests, migrate, smoke tests
set -euo pipefail

PROJECT_ID=${PROJECT_ID:-tcidcenter}
REGION=${REGION:-africa-south1}
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/tcid-repo"
TAG=${TAG:-$(git rev-parse HEAD)}
cd "$(git rev-parse --show-toplevel)"

build() {
  config=$(mktemp)
  cat > "$config" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-t", "$REGISTRY/backend:$TAG", "./backend"]
  - name: gcr.io/cloud-builders/docker
    args: ["build", "--build-arg", "REACT_APP_API_URL=/api", "--build-arg", "REACT_APP_SITE_URL=/", "-t", "$REGISTRY/frontend:$TAG", "./frontend"]
images: ["$REGISTRY/backend:$TAG", "$REGISTRY/frontend:$TAG"]
options: {machineType: E2_HIGHCPU_8}
timeout: 1800s
EOF
  gcloud builds submit --project="$PROJECT_ID" --config="$config" .
  rm -f "$config"
}

sync_secrets() {
  kubectl apply -f k8s/base/00-namespaces.yaml
  dir=$(mktemp -d)
  mkdir -p "$dir/app" "$dir/meet"
  get() { gcloud secrets versions access latest --project="$PROJECT_ID" --secret="$1" > "$2" 2>/dev/null || : > "$2"; }
  get tcid-django-secret-key "$dir/app/DJANGO_SECRET_KEY"
  get tcid-postgres-password "$dir/app/POSTGRES_PASSWORD"
  get tcid-jitsi-jwt-secret "$dir/app/JITSI_JWT_SECRET"
  get tcid-google-oauth-client-secret "$dir/app/GOOGLE_OAUTH_CLIENT_SECRET"
  get tcid-openai-api-key "$dir/app/OPENAI_API_KEY"
  cp "$dir/app/JITSI_JWT_SECRET" "$dir/meet/JITSI_JWT_SECRET"
  get tcid-jicofo-password "$dir/meet/JICOFO_AUTH_PASSWORD"
  get tcid-jvb-password "$dir/meet/JVB_AUTH_PASSWORD"
  get tcid-turn-secret "$dir/meet/TURN_SECRET"
  kubectl -n tcid create secret generic tcid-secrets --from-file="$dir/app" --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n tcid-meet create secret generic jitsi-secrets --from-file="$dir/meet" --dry-run=client -o yaml | kubectl apply -f -
  rm -rf "$dir"
}

deploy() {
  sync_secrets
  overlay=$(mktemp -d)
  cp -r k8s "$overlay/"
  sed -i "s/newTag: latest/newTag: $TAG/" "$overlay/k8s/overlays/prod/kustomization.yaml"
  kubectl apply -k "$overlay/k8s/overlays/prod"
  rm -rf "$overlay"
  kubectl -n tcid rollout status statefulset/postgres --timeout=600s

  kubectl -n tcid delete job migrate --ignore-not-found --wait=true
  sed "s#BACKEND_IMAGE#$REGISTRY/backend:$TAG#" k8s/jobs/migrate.yaml | kubectl apply -f -
  kubectl -n tcid wait --for=condition=complete job/migrate --timeout=600s ||
    { kubectl -n tcid logs job/migrate --tail=100; exit 1; }

  for d in backend frontend redis; do kubectl -n tcid rollout status "deployment/$d" --timeout=900s; done
  for d in prosody jicofo jitsi-web jvb coturn; do kubectl -n tcid-meet rollout status "deployment/$d" --timeout=900s; done

  for path in /api/readyz/ /meet/config.js /meet/_health; do
    kubectl -n tcid exec deploy/frontend -c nginx -- wget -q -O /dev/null "http://127.0.0.1:8080$path" &&
      echo "OK   $path" || echo "FAIL $path"
  done
}

case "${1:-}" in
  build) build ;;
  deploy) deploy ;;
  *) echo "usage: $0 build|deploy" >&2; exit 2 ;;
esac
