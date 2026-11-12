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
# After a stop the cluster has no node left: Autopilot creates two (one per
# zone of the database instances), which takes a few minutes. A slow service never stops the start: the script goes
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
    case $2 in
      cluster/*) ready=$(kubectl -n "$1" get "$2" -o jsonpath='{.status.readyInstances}' 2>/dev/null || true) ;;
      *) ready=$(kubectl -n "$1" get "$2" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true) ;;
    esac
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

  Google Cloud refused an extra node: the 250 GB SSD quota of africa-south1
  holds two nodes at most (100 to 200 GB each, plus the database disks). The
  site works with the pods already running; the waiting ones start as soon as
  room frees up. Lasting fix: raise SSD_TOTAL_GB (and IN_USE_ADDRESSES) in
  IAM & Admin > Quotas. If the site itself is down, run
  ./infra/stop-tcid.sh --no-backup then this script again.
EOF
  fi
}

kubectl cluster-info >/dev/null || { echo "kubectl cannot reach the cluster (run: gcloud container clusters get-credentials tcid-cluster --location=africa-south1)" >&2; exit 1; }

step "0/5 Load balancers (no change if they are already there)"
kubectl kustomize "$root/k8s/overlays/prod" | kubectl apply -l app.kubernetes.io/component=edge -f - "${dry[@]}"

# A dynamically created disk is deleted with its claim by default: keep the
# database disks (both instances, and the pre-CloudNativePG one) even if a
# claim is ever deleted by mistake (idempotent).
pvs="$(kubectl -n tcid get pvc -l cnpg.io/cluster=tcid-db -o jsonpath='{.items[*].spec.volumeName}' 2>/dev/null || true)"
pvs="$pvs $(kubectl -n tcid get pvc data-postgres-0 -o jsonpath='{.spec.volumeName}' 2>/dev/null || true)"
for pv in $pvs; do
  kubectl patch pv "$pv" "${dry[@]}" -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}' >/dev/null
done

# Every pod is requested at once: Autopilot then sizes the nodes for all of
# them in one go (one node per zone of the two database instances), instead
# of adding nodes one service at a time, which the project's 250 GB SSD quota
# cannot hold. The services wait for each other on their own (readiness
# probes, reconnections), and the checks below follow the dependency order.
step "1/5 Requesting every service (nodes are created, a few minutes)"
kubectl -n tcid annotate cluster tcid-db cnpg.io/hibernation=off --overwrite "${dry[@]}"
kubectl -n tcid scale deployment/redis --replicas=1 "${dry[@]}"
kubectl -n tcid scale deployment/backend deployment/frontend --replicas=2 "${dry[@]}"
kubectl -n tcid-meet scale deployment/prosody deployment/jicofo deployment/jvb deployment/jitsi-web deployment/coturn --replicas=1 "${dry[@]}"

step "2/5 PostgreSQL and Redis"
wait_ready tcid cluster/tcid-db 1
wait_ready tcid deployment/redis 1

step "3/5 API (backend)"
wait_ready tcid deployment/backend 1

step "4/5 Virtual classroom, then the web entry point"
for d in prosody jicofo jvb jitsi-web coturn; do wait_ready tcid-meet "deployment/$d" 1; done
wait_ready tcid deployment/frontend 1

# Everything is requested at once, before the nodes exist, so the web replicas
# often all land on the first node. Once a node runs in a second zone (the
# database one, at least), a rolling restart spreads them: one pod per zone,
# so the site survives the loss of a zone. PDBs keep a pod serving meanwhile.
zone_count() {  # <app>: number of zones holding its running pods
  local nodes
  nodes=$(kubectl -n tcid get pods -l "app=$1" --field-selector=status.phase=Running -o jsonpath='{.items[*].spec.nodeName}')
  [ -n "$nodes" ] || { echo 0; return; }
  # shellcheck disable=SC2086
  kubectl get nodes $nodes -o jsonpath='{range .items[*]}{.metadata.labels.topology\.kubernetes\.io/zone}{"\n"}{end}' | sort -u | grep -c .
}
if [ ${#dry[@]} = 0 ]; then
  node_zones=$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.labels.topology\.kubernetes\.io/zone}{"\n"}{end}' | sort -u | grep -c .)
  for d in backend frontend; do
    if [ "$node_zones" -ge 2 ] && [ "$(zone_count "$d")" -lt 2 ]; then
      step "Spreading $d over two zones (rolling restart, no downtime)"
      kubectl -n tcid rollout restart "deployment/$d"
      kubectl -n tcid rollout status "deployment/$d" --timeout=300s || slow+=("tcid deployment/$d (spreading)")
    fi
  done
fi

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
