# CI/CD and VPS deployment code

The workflow at `.github/workflows/ci-cd.yml` runs Django integration tests
against PostgreSQL, React tests and a production build, and Docker image builds
on pull requests and pushes to `main`. Only a successful push to `main` deploys.

## GitHub Actions secrets

Configure these repository secrets before pushing to `main`:

- `VPS_HOST`: VPS IP address or hostname.
- `VPS_DOMAIN`: public domain, without `https://` (for example,
  `tcid-madagascar.com`).
- `VPS_USERNAME`: SSH account used by Actions.
- `VPS_SSH_KEY`: private OpenSSH key for that account.
- `VPS_FINGERPRINT`: trusted SSH host-key fingerprint (`SHA256:...`).
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`: optional; the workflow
  writes non-empty values to the VPS environment file.

Do not use the VPS password that was shared in chat. Rotate it, configure
key-based SSH access, and prefer a dedicated deployment account over `root`.
The deployment account must be able to run Docker Compose.

The first deployment populates `/var/www/tcid-manage/.env` on the VPS with a
generated Django secret, a generated PostgreSQL password, production `DEBUG`
settings, the VPS host, and `VPS_DOMAIN` as allowed hosts. Existing non-empty
database credentials and secret keys are preserved; the domain and host lists
are updated from the GitHub secrets. Optional OpenAI secrets are refreshed
from GitHub Actions. PostgreSQL, uploaded media, and Caddy's HTTPS certificates
persist in Docker volumes across deployments.

## Virtual classroom (Jitsi Meet SFU)

The classroom video runs on a self-hosted Jitsi Meet stack (`jitsi-web`,
`jitsi-prosody`, `jitsi-jicofo`, `jitsi-jvb`) served at
`https://<VPS_DOMAIN>/meet/` (Jitsi "meet" tenant, so no extra DNS record or
certificate is needed). Each participant receives a short-lived JWT from
the backend (`/api/live-classrooms/<id>/join/`): trainers join as moderators,
learners as members, and nobody can enter a room without a token.

Before the first deployment:

- Firewall: open `10000/udp` (Jitsi media) plus the TURN ports
  `3478/tcp+udp` and `49160-49200/udp` (fallback when UDP 10000 is blocked).
  With `ufw`: `sudo ufw allow 10000/udp && sudo ufw allow 3478 && sudo ufw allow 49160:49200/udp`.
- The deployment generates `JITSI_JWT_SECRET`, `JICOFO_AUTH_PASSWORD`,
  `JVB_AUTH_PASSWORD` and `TURN_SECRET` once, and sets `JVB_ADVERTISE_IPS`
  from `VPS_HOST`. Jitsi needs about 4 GB of RAM.

## Google sign-in for learners and trainers

Learners sign in or sign up on `/user-register` (the old `/user-login`
redirects there), by e-mail or with Google. Trainers get the same Google
button on `/teacher-login` and `/teacher-register`; a new trainer account
created with Google always waits for administrator approval. In Google Cloud Console the OAuth
client must list `https://<VPS_DOMAIN>/api/auth/callback/google` as an
authorized redirect URI. Add the GitHub secret `GOOGLE_OAUTH_CLIENT_SECRET`
(and optionally `GOOGLE_OAUTH_CLIENT_ID`); the button stays hidden until the
secret is set. New Google accounts wait for administrator approval unless
`GOOGLE_AUTO_APPROVE_STUDENTS=True` is set in the VPS `.env`.

## Mobile money payments

Learners pay by Orange Money, Airtel Money or MVola, then send the reference
and amount. Only staff users of the admin console (`/admin`) can validate a
payment, by typing the same reference. The numbers shown to learners can be
changed with `PAYMENT_ORANGE_NUMBER`, `PAYMENT_AIRTEL_NUMBER`,
`PAYMENT_MVOLA_NUMBER` and `PAYMENT_ACCOUNT_HOLDER` in the VPS `.env`.

The Compose stack serves the site over HTTP on port 80 and HTTPS on port 443;
Caddy obtains and renews certificates automatically. Point both the domain and
its `www` subdomain to the VPS, and allow inbound TCP ports 80 and 443 in the
VPS/network firewall. In Cloudflare, make sure the origin address is this VPS
and use Full (strict) SSL mode after the origin certificate is issued.
