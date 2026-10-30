#!/usr/bin/env bash
# Wake TCiD Center up (morning): restarts every service in dependency order,
# then checks the public site end to end.
#
#   ./infra/start-tcid.sh
#   DRY_RUN=1 ./infra/start-tcid.sh    # show what would happen, change nothing
#
# Replica counts match k8s/base (the autoscalers take over from there).
set -euo pipefail

SITE=${SITE:-https://tcid-madagascar.com}
dry=()
[ "${DRY_RUN:-0}" = 1 ] && dry=(--dry-run=server)
step() { printf '\n==> %s\n' "$*"; }
wait_rollout() { [ ${#dry[@]} -gt 0 ] || kubectl -n "$1" rollout status "$2" --timeout=900s; }

kubectl cluster-info >/dev/null || { echo "kubectl cannot reach the cluster (run: gcloud container clusters get-credentials tcid-cluster --location=africa-south1)" >&2; exit 1; }

step "1/5 PostgreSQL and Redis"
kubectl -n tcid scale statefulset/postgres --replicas=1 "${dry[@]}"
kubectl -n tcid scale deployment/redis --replicas=1 "${dry[@]}"
wait_rollout tcid statefulset/postgres
wait_rollout tcid deployment/redis

step "2/5 API (backend)"
kubectl -n tcid scale deployment/backend --replicas=2 "${dry[@]}"
wait_rollout tcid deployment/backend

step "3/5 Virtual classroom (prosody first: the others connect to it)"
kubectl -n tcid-meet scale deployment/prosody --replicas=1 "${dry[@]}"
wait_rollout tcid-meet deployment/prosody
kubectl -n tcid-meet scale deployment/jicofo deployment/jvb deployment/jitsi-web deployment/coturn --replicas=1 "${dry[@]}"
for d in jicofo jvb jitsi-web coturn; do wait_rollout tcid-meet "deployment/$d"; done

step "4/5 Web entry point (frontend)"
kubectl -n tcid scale deployment/frontend --replicas=2 "${dry[@]}"
wait_rollout tcid deployment/frontend

step "5/5 Nightly backup resumed"
kubectl -n tcid patch cronjob postgres-backup "${dry[@]}" -p '{"spec":{"suspend":false}}'

[ ${#dry[@]} -gt 0 ] && { echo "Dry run: nothing changed."; exit 0; }

step "Checking the public site (the load balancer may need a minute)"
ok=1
for path in / /api/readyz/ /meet/config.js /meet/_health; do
  code=000
  for attempt in $(seq 1 18); do
    code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SITE$path") || true
    [ "$code" = 200 ] && break
    sleep 10
  done
  printf '%-18s %s\n' "$path" "$code"
  [ "$code" = 200 ] || ok=0
done

kubectl get pods -n tcid
kubectl get pods -n tcid-meet
if [ "$ok" = 1 ]; then
  echo; echo "TCiD Center is up: $SITE"
else
  echo; echo "Some checks failed: see kubectl describe pod / kubectl logs above." >&2
  exit 1
fi
