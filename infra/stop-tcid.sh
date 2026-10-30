#!/usr/bin/env bash
# Put TCiD Center to sleep (evening): every pod stops, nothing is deleted.
#
#   ./infra/stop-tcid.sh               # backup, then stop everything
#   ./infra/stop-tcid.sh --no-backup   # stop without the safety backup
#   DRY_RUN=1 ./infra/stop-tcid.sh     # show what would happen, change nothing
#
# Kept while asleep: database disk, media and backup buckets, secrets, static
# IPs, load balancers, certificates, manifests and images. Only the number of
# running pods changes, so the CI/CD pipeline is not affected (a push while
# asleep simply redeploys and wakes the platform up).
# Cost while asleep: no pod is billed; disks, IPs and load balancers remain.
set -euo pipefail

backup=1
[ "${1:-}" = "--no-backup" ] && backup=0
dry=()
[ "${DRY_RUN:-0}" = 1 ] && dry=(--dry-run=server)
step() { printf '\n==> %s\n' "$*"; }

kubectl cluster-info >/dev/null || { echo "kubectl cannot reach the cluster (run: gcloud container clusters get-credentials tcid-cluster --location=africa-south1)" >&2; exit 1; }

if [ "$backup" = 1 ] && [ ${#dry[@]} = 0 ]; then
  step "Safety backup of PostgreSQL before stopping"
  job="before-stop-$(date +%Y%m%d-%H%M)"
  kubectl -n tcid create job "$job" --from=cronjob/postgres-backup
  kubectl -n tcid wait --for=condition=complete "job/$job" --timeout=600s
  kubectl -n tcid logs "job/$job" | tail -1
fi

step "Pausing the nightly backup (the database will be stopped)"
kubectl -n tcid patch cronjob postgres-backup "${dry[@]}" -p '{"spec":{"suspend":true}}'

# Entry points first, database last, so no request reaches a stopped service.
step "Stopping the web tier"
kubectl -n tcid scale deployment/frontend deployment/backend --replicas=0 "${dry[@]}"

step "Stopping the virtual classroom"
kubectl -n tcid-meet scale deployment/jitsi-web deployment/jicofo deployment/jvb deployment/coturn deployment/prosody --replicas=0 "${dry[@]}"

step "Stopping Redis and PostgreSQL (data stays on its disk)"
kubectl -n tcid scale deployment/redis --replicas=0 "${dry[@]}"
kubectl -n tcid scale statefulset/postgres --replicas=0 "${dry[@]}"

if [ ${#dry[@]} = 0 ]; then
  step "Waiting for every pod to stop"
  kubectl -n tcid wait --for=delete pod -l 'app in (frontend,backend,redis,postgres)' --timeout=300s || true
  kubectl -n tcid-meet wait --for=delete pod --all --timeout=300s || true
fi

step "State"
kubectl get deploy,statefulset -n tcid
kubectl get deploy -n tcid-meet
echo
echo "TCiD Center is asleep. Wake it up with: ./infra/start-tcid.sh"
