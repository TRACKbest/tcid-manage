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

Nothing has to be configured in GitHub: the workflow carries the Google Cloud
identifiers (none is secret) and authenticates through Workload Identity
Federation. Every push to `main` deploys.

DNS (Cloudflare): `A` records for `@` and `www` pointing to the `tcid-ip`
address (`136.69.9.92`). Two supported modes:

- **DNS only** (grey cloud): Google issues and renews the `tcid-cert`
  managed certificate by itself.
- **Proxied** (orange cloud, SSL/TLS mode *Full*): Google cannot validate the
  domain, so the load balancer serves an origin certificate stored in the
  `tcid-origin-tls` secret (self-signed, valid one year), added to the
  Ingress with
  `kubectl -n tcid patch ingress tcid --type=merge -p '{"spec":{"tls":[{"secretName":"tcid-origin-tls"}]}}'`.
  A Cloudflare Origin CA certificate can replace it to use *Full (strict)*.

## Daily operations

```bash
kubectl get pods -n tcid                      # application
kubectl get pods -n tcid-meet                 # classroom
kubectl get hpa -n tcid                       # autoscaling
kubectl describe managedcertificate tcid-cert -n tcid
kubectl -n tcid rollout undo deployment/backend   # roll back
kubectl -n tcid create job --from=cronjob/postgres-backup manual-backup
```

### Sleep at night, wake up in the morning

```bash
./infra/stop-tcid.sh     # PowerShell: .\infra\stop-tcid.ps1
./infra/start-tcid.sh    # PowerShell: .\infra\start-tcid.ps1
```

`stop` takes a safety backup, pauses the nightly backup and scales every
pod to zero; `start` brings PostgreSQL, Redis, the API, Jitsi and nginx back
in order, resumes the backup and checks the public site. Disks, buckets,
secrets, IPs, load balancers and certificates are never touched, and the
pipeline is unaffected (a push while asleep redeploys and wakes the site up).
`DRY_RUN=1` shows the actions without applying them. `stop-tcid.sh --deep`
also releases the three load balancers (their hourly forwarding-rule fee);
the static IPs stay reserved and `start-tcid.sh` rebuilds them, which takes
about 10 minutes instead of 2.

### Autoscaling, resilience, load test

The HPAs own the web pod count (manifests set no `replicas`), every workload
has a VPA in recommendation mode, and the pipeline backs up the database
before migrations and rolls back the images when a deployment fails. A daily
workflow (`drift.yml`) compares the cluster with `main`. Details, procedures
and the target architecture: [docs/AUTOSCALING-RESILIENCE.md](docs/AUTOSCALING-RESILIENCE.md).

```bash
./infra/load-test.sh            # 150 virtual users for 8 minutes, watch the HPAs
./infra/setup-gcp.sh observe    # metrics packages, dashboard, image cleanup
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
