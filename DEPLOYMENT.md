# CI/CD and VPS deployment

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

The Compose stack serves the site over HTTP on port 80 and HTTPS on port 443;
Caddy obtains and renews certificates automatically. Point both the domain and
its `www` subdomain to the VPS, and allow inbound TCP ports 80 and 443 in the
VPS/network firewall. In Cloudflare, make sure the origin address is this VPS
and use Full (strict) SSL mode after the origin certificate is issued.
