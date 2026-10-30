#!/usr/bin/env bash
# Put TCiD Center to sleep (evening): every pod stops, nothing is deleted.
#
#   ./infra/stop-tcid.sh               # backup, then stop everything
#   ./infra/stop-tcid.sh --no-backup   # stop without the safety backup
#   ./infra/stop-tcid.sh --deep        # also release the 3 load balancers
#   DRY_RUN=1 ./infra/stop-tcid.sh     # show what would happen, change nothing
#
# Kept while asleep: database disk, media and backup buckets, secrets, static
# IPs, certificates, manifests and images, so the CI/CD pipeline is not
# affected (a push while asleep simply redeploys and wakes the platform up).
# Cost while asleep: no pod is billed. What remains is the cluster fee
# (covered by the GKE free tier credit for one cluster), the disk, the static
# IPs and, without --deep, the forwarding rules of the load balancers.
# --deep removes those forwarding rules too; waking up then takes about
# 10 minutes instead of 2, while Google rebuilds the HTTPS load balancer.
set -euo pipefail

backup=1 deep=0
for arg in "$@"; do
  case $arg in
    --no-backup) backup=0 ;;
    --deep) deep=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
dry=()
[ "${DRY_RUN:-0}" = 1 ] && dry=(--dry-run=server)
step() { printf '\n==> %s\n' "$*"; }

kubectl cluster-info >/dev/null || { echo "kubectl cannot reach the cluster (run: gcloud container clusters get-credentials tcid-cluster --location=africa-south1)" >&2; exit 1; }

if [ "$backup" = 1 ] && [ ${#dry[@]} = 0 ]; then
  step "Safety backup of PostgreSQL before stopping"
  job="before-stop-$(date +%Y%m%d-%H%M)"
  kubectl -n tcid create job "$job" --from=cronjob/postgres-backup
  # The database is only stopped once its backup is confirmed.
  if ! kubectl -n tcid wait --for=condition=complete "job/$job" --timeout=600s; then
    kubectl -n tcid logs "job/$job" --tail=20 || true
    echo "Backup failed: nothing was stopped." >&2
    exit 1
  fi
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

if [ "$deep" = 1 ]; then
  # Static IPs stay reserved, so start-tcid gets the same addresses back.
  step "Releasing the load balancers (HTTPS, videobridge, TURN)"
  kubectl -n tcid delete ingress tcid --ignore-not-found --wait=false "${dry[@]}"
  for svc in jvb coturn; do
    kubectl -n tcid-meet patch service "$svc" --type=merge "${dry[@]}" \
      -p '{"spec":{"type":"ClusterIP","loadBalancerIP":null,"externalTrafficPolicy":null}}'
  done
fi

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
