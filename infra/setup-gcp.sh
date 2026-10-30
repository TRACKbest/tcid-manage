#!/usr/bin/env bash
# Provision the TCiD Center infrastructure on Google Cloud (idempotent).
#
#   ./infra/setup-gcp.sh            # everything except the cluster
#   ./infra/setup-gcp.sh cluster    # GKE Autopilot cluster (about 10 minutes)
#   ./infra/setup-gcp.sh workload   # bucket access for the pods (after the cluster)
#   ./infra/setup-gcp.sh outputs    # values to copy into GitHub and the overlay
#   ./infra/setup-gcp.sh observe    # cost-aware monitoring, dashboard, image cleanup
#
# Security choices: no service-account key anywhere (GitHub uses OIDC through
# Workload Identity Federation, pods use Workload Identity), secrets generated
# here and kept in Secret Manager, private buckets, TLS 1.2+, Cloud Armor.
set -euo pipefail

PROJECT_ID=${PROJECT_ID:-tcidcenter}
REGION=${REGION:-africa-south1}
CLUSTER=${CLUSTER:-tcid-cluster}
REPO=${REPO:-tcid-repo}
GITHUB_REPO=${GITHUB_REPO:-TRACKbest/tcid-manage}
MEDIA_BUCKET=${MEDIA_BUCKET:-tcidcenter-media}
BACKUP_BUCKET=${BACKUP_BUCKET:-tcidcenter-backups}
DEPLOY_SA=tcid-deployer@${PROJECT_ID}.iam.gserviceaccount.com

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
step() { printf '\n==> %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

base() {
  step "APIs"
  gcloud services enable container.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com compute.googleapis.com storage.googleapis.com \
    iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
    cloudresourcemanager.googleapis.com

  step "Artifact Registry ($REPO)"
  exists gcloud artifacts repositories describe "$REPO" --location="$REGION" ||
    gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" \
      --description="TCiD Center images"

  step "Static IPs: HTTPS load balancer (global), videobridge and TURN (regional)"
  exists gcloud compute addresses describe tcid-ip --global ||
    gcloud compute addresses create tcid-ip --global
  for name in tcid-jvb-ip tcid-turn-ip; do
    exists gcloud compute addresses describe "$name" --region="$REGION" ||
      gcloud compute addresses create "$name" --region="$REGION"
  done

  step "Private buckets: media ($MEDIA_BUCKET) and database backups ($BACKUP_BUCKET, 30 days)"
  for bucket in "$MEDIA_BUCKET" "$BACKUP_BUCKET"; do
    exists gcloud storage buckets describe "gs://$bucket" ||
      gcloud storage buckets create "gs://$bucket" --location="$REGION" \
        --uniform-bucket-level-access --public-access-prevention
  done
  lifecycle=$(mktemp)
  echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > "$lifecycle"
  gcloud storage buckets update "gs://$BACKUP_BUCKET" --lifecycle-file="$lifecycle"
  rm -f "$lifecycle"

  step "TLS policy (TLS 1.2 minimum, modern ciphers)"
  exists gcloud compute ssl-policies describe tcid-ssl-policy ||
    gcloud compute ssl-policies create tcid-ssl-policy --profile=MODERN --min-tls-version=1.2

  # Optional: new projects often have a Cloud Armor quota of 0. Once the
  # quota is granted, add "securityPolicy: {name: tcid-armor}" to the
  # BackendConfig in k8s/base/50-ingress.yaml.
  step "Cloud Armor (optional): 600 requests per minute per IP, then HTTP 429"
  if ! exists gcloud compute security-policies describe tcid-armor; then
    if gcloud compute security-policies create tcid-armor --description="TCiD edge protection"; then
      gcloud compute security-policies rules create 1000 --security-policy=tcid-armor \
        --src-ip-ranges='*' --action=throttle --rate-limit-threshold-count=600 \
        --rate-limit-threshold-interval-sec=60 --conform-action=allow \
        --exceed-action=deny-429 --enforce-on-key=IP
    else
      echo "Cloud Armor skipped (quota SECURITY_POLICIES is 0): request a quota increase."
    fi
  fi

  step "Secrets generated once in Secret Manager (values never printed)"
  for secret in tcid-django-secret-key tcid-postgres-password tcid-jitsi-jwt-secret \
      tcid-jicofo-password tcid-jvb-password tcid-turn-secret; do
    exists gcloud secrets describe "$secret" ||
      openssl rand -hex 32 | tr -d '\n' |
        gcloud secrets create "$secret" --replication-policy=automatic --data-file=-
  done
  for secret in tcid-google-oauth-client-secret tcid-openai-api-key; do
    exists gcloud secrets describe "$secret" ||
      gcloud secrets create "$secret" --replication-policy=automatic
  done

  step "Deployment identity for GitHub Actions (least privilege)"
  exists gcloud iam service-accounts describe "$DEPLOY_SA" ||
    gcloud iam service-accounts create tcid-deployer --display-name="GitHub Actions deployer"
  gcloud artifacts repositories add-iam-policy-binding "$REPO" --location="$REGION" \
    --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer >/dev/null
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition=None \
    --member="serviceAccount:$DEPLOY_SA" --role=roles/container.developer >/dev/null
  for secret in tcid-django-secret-key tcid-postgres-password tcid-jitsi-jwt-secret \
      tcid-jicofo-password tcid-jvb-password tcid-turn-secret \
      tcid-google-oauth-client-secret tcid-openai-api-key; do
    gcloud secrets add-iam-policy-binding "$secret" --member="serviceAccount:$DEPLOY_SA" \
      --role=roles/secretmanager.secretAccessor >/dev/null
  done

  step "Workload Identity Federation: only $GITHUB_REPO on main may deploy (no JSON key)"
  exists gcloud iam workload-identity-pools describe github --location=global ||
    gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
  exists gcloud iam workload-identity-pools providers describe github-oidc --location=global --workload-identity-pool=github ||
    gcloud iam workload-identity-pools providers create-oidc github-oidc --location=global \
      --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
      --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref \
      --attribute-condition="assertion.repository=='$GITHUB_REPO' && assertion.ref=='refs/heads/main'"
  gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
    --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO" >/dev/null
}

cluster() {
  step "GKE Autopilot cluster $CLUSTER in $REGION (regional, auto-upgraded, hardened nodes)"
  exists gcloud container clusters describe "$CLUSTER" --location="$REGION" ||
    gcloud container clusters create-auto "$CLUSTER" --location="$REGION" --release-channel=regular
  gcloud container clusters get-credentials "$CLUSTER" --location="$REGION"
}

workload() {
  step "Workload Identity: pods reach their buckets with their Kubernetes identity"
  pool="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$PROJECT_ID.svc.id.goog/subject/ns/tcid/sa"
  gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" --member="$pool/backend" --role=roles/storage.objectUser >/dev/null
  gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" --member="$pool/frontend" --role=roles/storage.objectViewer >/dev/null
  gcloud storage buckets add-iam-policy-binding "gs://$BACKUP_BUCKET" --member="$pool/db-backup" --role=roles/storage.objectUser >/dev/null
  echo "done"
}

observe() {
  step "Cluster metrics: system, kube-state (pods, deployments, HPA) and storage"
  # cAdvisor/kubelet (duplicates of the system metrics), GPU (DCGM) and JobSet
  # packages are billed per sample and not needed here.
  gcloud container clusters update "$CLUSTER" --location="$REGION" \
    --monitoring=SYSTEM,POD,DEPLOYMENT,STATEFULSET,DAEMONSET,HPA,STORAGE

  step "Cloud Monitoring dashboard (CPU/RAM, replicas, HPA, VPA, restarts)"
  dashboard="$(dirname "$0")/monitoring/dashboard.json"
  name="TCiD Center - GKE autoscaling"   # displayName in dashboard.json
  if [ -z "$(gcloud monitoring dashboards list --filter="displayName=\"$name\"" --format='value(name)')" ]; then
    gcloud monitoring dashboards create --config-from-file="$dashboard"
  else
    echo "already there: $name"
  fi

  step "Artifact Registry cleanup: keep the 10 latest images of each kind"
  policy=$(mktemp)
  cat > "$policy" <<'JSON'
[
  {"name": "keep-latest", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 10}},
  {"name": "delete-old", "action": {"type": "Delete"}, "condition": {"olderThan": "30d"}}
]
JSON
  gcloud artifacts repositories set-cleanup-policies "$REPO" --location="$REGION" \
    --policy="$policy" --no-dry-run
  rm -f "$policy"
}

outputs() {
  step "GitHub repository variables (Settings > Secrets and variables > Actions > Variables)"
  echo "GCP_PROJECT_ID   = $PROJECT_ID"
  echo "GCP_REGION       = $REGION"
  echo "GCP_DEPLOY_SA    = $DEPLOY_SA"
  echo "GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-oidc"
  echo "GKE_ENABLED      = true"
  step "k8s/overlays/prod/network.env"
  echo "JVB_IP=$(gcloud compute addresses describe tcid-jvb-ip --region="$REGION" --format='value(address)')"
  echo "TURN_IP=$(gcloud compute addresses describe tcid-turn-ip --region="$REGION" --format='value(address)')"
  step "DNS (Cloudflare, records A for @ and www, DNS only / grey cloud)"
  echo "$(gcloud compute addresses describe tcid-ip --global --format='value(address)')"
}

case "${1:-base}" in
  base) base ;;
  cluster) cluster ;;
  workload) workload ;;
  outputs) outputs ;;
  observe) observe ;;
  *) echo "usage: $0 [base|cluster|workload|outputs|observe]" >&2; exit 2 ;;
esac
