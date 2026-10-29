# Deployment on Google Kubernetes Engine

Production runs on **GKE Autopilot** (project `tcidcenter`, region
`africa-south1`, closest to Madagascar). The former VPS deployment (Docker
Compose + Caddy) is retired; `docker-compose.yml` remains for local runs.

## Architecture

| Layer | Component |
|---|---|
| Edge | Global HTTPS load balancer (static IP `tcid-ip`), Google-managed certificate, HTTP→HTTPS redirect, TLS 1.2+ policy |
| Web | `frontend` (unprivileged nginx, React build) → `backend` (Django/Daphne ASGI), HPA 2–10 pods |
| Data | PostgreSQL 16 StatefulSet (20 Gi persistent disk), Redis (WebSocket channel layer) |
| Files | Cloud Storage bucket `tcidcenter-media` mounted through the GCS FUSE CSI driver |
| Backups | Nightly `pg_dump` CronJob into `tcidcenter-backups` (deleted after 30 days) |
| Classroom | Jitsi (web, prosody, jicofo) + videobridge on a UDP load balancer (`tcid-jvb-ip`, port 10000) + TURN over TCP 3478 (`tcid-turn-ip`) |

Security: namespace `tcid` enforces the *restricted* Pod Security Standard,
NetworkPolicies deny all inbound traffic except the flows of the diagram,
secrets come from Secret Manager, pods use Workload Identity, and GitHub
deploys without any key through Workload Identity Federation (OIDC).

## Files

- `infra/setup-gcp.sh` — provisions everything on Google Cloud (idempotent).
- `k8s/base/` — Kubernetes manifests; `k8s/overlays/prod/` — images and IPs.
- `k8s/jobs/migrate.yaml` — database migrations run by each deployment.
- `.github/workflows/ci-cd.yml` — tests → manifest validation → image build
  and Trivy scan → push to Artifact Registry → deploy → smoke tests.

## First installation

```bash
./infra/setup-gcp.sh            # APIs, registry, IPs, buckets, secrets, IAM, OIDC
./infra/setup-gcp.sh cluster    # GKE Autopilot cluster
./infra/setup-gcp.sh workload   # bucket access for the pods
./infra/setup-gcp.sh outputs    # GitHub variables, IPs, DNS target
```

Then add the secrets that cannot be generated:

```bash
gcloud secrets versions add tcid-google-oauth-client-secret --data-file=secret.txt
gcloud secrets versions add tcid-openai-api-key --data-file=key.txt
```

In GitHub (*Settings → Secrets and variables → Actions → Variables*) set
`GCP_PROJECT_ID`, `GCP_REGION`, `GCP_DEPLOY_SA`, `GCP_WIF_PROVIDER` and
`GKE_ENABLED=true`. Every push to `main` then deploys.

DNS (Cloudflare): `A` records for `@` and `www` pointing to the `tcid-ip`
address, **DNS only** (grey cloud) so Google can issue the certificate.

## Daily operations

```bash
kubectl get pods -n tcid                      # application
kubectl get pods -n tcid-meet                 # classroom
kubectl get hpa -n tcid                       # autoscaling
kubectl describe managedcertificate tcid-cert -n tcid
kubectl -n tcid rollout undo deployment/backend   # roll back
kubectl -n tcid create job --from=cronjob/postgres-backup manual-backup
```

Cloud Armor (rate limiting) is ready in `infra/setup-gcp.sh` but needs a
`SECURITY_POLICIES` quota increase on new projects; then add
`securityPolicy: {name: tcid-armor}` to the BackendConfig.

## Mobile money payments

Learners pay by Orange Money, Airtel Money or MVola, then send the reference
and amount. Only staff users of the admin console (`/admin`) can validate a
payment, by typing the same reference. The numbers shown to learners can be
changed with `PAYMENT_ORANGE_NUMBER`, `PAYMENT_AIRTEL_NUMBER`,
`PAYMENT_MVOLA_NUMBER` and `PAYMENT_ACCOUNT_HOLDER` in `k8s/base/10-app-config.yaml`.

## Google sign-in

The OAuth client must list `https://tcid-madagascar.com/api/auth/callback/google`
as an authorized redirect URI. New Google accounts wait for administrator
approval unless `GOOGLE_AUTO_APPROVE_STUDENTS=True` is set in the ConfigMap.
