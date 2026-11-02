#!/usr/bin/env bash
# Wake TCiD Center up (morning): restarts every service in dependency order,
# then checks the public site end to end.
#
#   ./infra/start-tcid.sh
#   DRY_RUN=1 ./infra/start-tcid.sh    # show what would happen, change nothing
#   WAIT=900 ./infra/start-tcid.sh     # seconds to wait for each service (default 600)
#
# Replica counts match k8s/base (the autoscalers take over from there).
# Load balancers released by "stop-tcid.sh --deep" are recreated first.
# After a stop the cluster has no node left: Autopilot creates one, which
# takes a few minutes. A slow service never stops the start: the script goes
# on with the next one, then explains at the end what is still waiting.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)

SITE=${SITE:-https://tcid-madagascar.com}
WAIT=${WAIT:-600}
dry=()
[ "${DRY_RUN:-0}" = 1 ] && dry=(--dry-run=server)
slow=()
step() { printf '\n==> %s\n' "$*"; }

# wait_ready <namespace> <kind/name> <pods>: wait until that many pods are
# ready. The web tier only needs one pod to serve the site.
wait_ready() {
  [ ${#dry[@]} -gt 0 ] && return 0
  local end=$((SECONDS + WAIT)) ready
  while [ $SECONDS -lt $end ]; do
    ready=$(kubectl -n "$1" get "$2" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)
    if [ "${ready:-0}" -ge "$3" ]; then
      echo "$2: ${ready} ready"
      return 0
    fi
    sleep 10
  done
  echo "WARNING: $2 is not ready after ${WAIT}s, continuing" >&2
  slow+=("$1 $2")
}

# Why are pods still waiting? Prints the last event of each one and the fix
# for the usual causes; prints nothing when every pod runs.
diagnose() {
  local ns pod msg quota=0 header=0
  for ns in tcid tcid-meet; do
    for pod in $(kubectl -n "$ns" get pods --no-headers 2>/dev/null | awk '$3 != "Running" && $3 != "Completed" {print $1}'); do
      [ "$header" = 1 ] || { step "Pods still waiting"; header=1; }
      msg=$(kubectl -n "$ns" get events --field-selector "involvedObject.name=$pod" --sort-by=.lastTimestamp \
        -o jsonpath='{.items[-1:].message}' 2>/dev/null || true)
      printf '  %-12s %-36s %s\n' "$ns" "$pod" "${msg:-no event yet}"
      case $msg in *quota*) quota=1 ;; esac
    done
  done
  if [ "$quota" = 1 ]; then
    cat >&2 <<'EOF'

  Google Cloud refused to create a node: quota exceeded (usually
  "Persistent Disk SSD (GB)" in africa-south1). Console: IAM & Admin >
  Quotas & system limits > filter "Persistent Disk SSD" > Edit quota (500 GB).
  The site already works with the pods that are running.
EOF
  fi
}

kubectl cluster-info >/dev/null || { echo "kubectl cannot reach the cluster (run: gcloud container clusters get-credentials tcid-cluster --location=africa-south1)" >&2; exit 1; }

step "0/5 Load balancers (no change if they are already there)"
kubectl kustomize "$root/k8s/overlays/prod" | kubectl apply -l app.kubernetes.io/component=edge -f - "${dry[@]}"

step "1/5 PostgreSQL and Redis (the first node may take a few minutes)"
kubectl -n tcid scale statefulset/postgres --replicas=1 "${dry[@]}"
kubectl -n tcid scale deployment/redis --replicas=1 "${dry[@]}"
wait_ready tcid statefulset/postgres 1
wait_ready tcid deployment/redis 1

step "2/5 API (backend)"
kubectl -n tcid scale deployment/backend --replicas=2 "${dry[@]}"
wait_ready tcid deployment/backend 1

step "3/5 Virtual classroom (prosody first: the others connect to it)"
kubectl -n tcid-meet scale deployment/prosody --replicas=1 "${dry[@]}"
wait_ready tcid-meet deployment/prosody 1
kubectl -n tcid-meet scale deployment/jicofo deployment/jvb deployment/jitsi-web deployment/coturn --replicas=1 "${dry[@]}"
for d in jicofo jvb jitsi-web coturn; do wait_ready tcid-meet "deployment/$d" 1; done

step "4/5 Web entry point (frontend)"
kubectl -n tcid scale deployment/frontend --replicas=2 "${dry[@]}"
wait_ready tcid deployment/frontend 1

step "5/5 Nightly backup resumed"
kubectl -n tcid patch cronjob postgres-backup "${dry[@]}" -p '{"spec":{"suspend":false}}'

[ ${#dry[@]} -gt 0 ] && { echo "Dry run: nothing changed."; exit 0; }

step "Checking the public site (a load balancer rebuilt after --deep needs up to 10 minutes)"
ok=1
for path in / /api/readyz/ /meet/config.js /meet/_health; do
  code=000
  for attempt in $(seq 1 60); do
    code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SITE$path") || true
    [ "$code" = 200 ] && break
    sleep 10
  done
  printf '%-18s %s\n' "$path" "$code"
  [ "$code" = 200 ] || ok=0
done

kubectl get pods -n tcid
kubectl get pods -n tcid-meet
diagnose
if [ "$ok" = 1 ]; then
  echo; echo "TCiD Center is up: $SITE"
else
  echo; echo "Some checks failed: see the pods and messages above (kubectl describe pod / kubectl logs)." >&2
  exit 1
fi
