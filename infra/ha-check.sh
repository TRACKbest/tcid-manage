#!/usr/bin/env bash
# High-availability checks for TCiD Center on GKE Autopilot.
#
#   ./infra/ha-check.sh                    # read-only: zones, spreading, PDBs, impact of losing each zone
#   ./infra/ha-check.sh --pod-test         # also deletes ONE backend pod and measures the site meanwhile
#   ./infra/ha-check.sh --db-failover      # also deletes the PostgreSQL primary pod: the standby takes over
#   ./infra/ha-check.sh --zone-drill ZONE  # simulates the loss of ZONE (cordon + eviction of the app pods, then uncordon);
#                                          # asks you to type the zone name before doing anything
#
# Nothing here deletes data or volumes. The default mode changes nothing.
# The platform must be running (./infra/start-tcid.sh).
set -euo pipefail

SITE=${SITE:-https://tcid-madagascar.com}
pod_test=0 db_failover=0 drill_zone=''
while [ $# -gt 0 ]; do
  case $1 in
    --pod-test) pod_test=1 ;;
    --db-failover) db_failover=1 ;;
    --zone-drill) drill_zone=${2:?--zone-drill needs a zone, e.g. africa-south1-b}; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
step() { printf '\n==> %s\n' "$*"; }
k() { kubectl "$@" | tr -d '\r'; }

kubectl cluster-info >/dev/null || { echo "kubectl cannot reach the cluster" >&2; exit 1; }

# node -> zone map
declare -A zone_of=()
while read -r node zone; do zone_of[$node]=$zone; done < <(k get nodes --no-headers -L topology.kubernetes.io/zone | awk '{print $1, $NF}')
if [ ${#zone_of[@]} = 0 ]; then
  echo "No node: the platform is asleep. Start it first: ./infra/start-tcid.sh" >&2; exit 1
fi

step "1. Nodes per zone"
for n in "${!zone_of[@]}"; do echo "${zone_of[$n]}  $n"; done | sort
zones=$(printf '%s\n' "${zone_of[@]}" | sort -u | wc -l)
echo "-> $zones zone(s) in use"

step "2. Pods and their zone"
pods_of_app() {  # <ns> <app>: "pod node" lines of running pods
  k get pods -n "$1" -l "app=$2" --field-selector=status.phase=Running -o jsonpath='{range .items[*]}{.metadata.name} {.spec.nodeName}{"\n"}{end}'
}
for ns in tcid tcid-meet; do
  while read -r pod node; do
    [ -n "$pod" ] && printf '%-10s %-44s %s\n' "$ns" "$pod" "${zone_of[$node]:-?}"
  done < <(k get pods -n "$ns" --field-selector=status.phase=Running -o jsonpath='{range .items[*]}{.metadata.name} {.spec.nodeName}{"\n"}{end}')
done

step "3. Spreading of the replicated tiers"
for app in backend frontend; do
  z=$(pods_of_app tcid "$app" | while read -r _ node; do echo "${zone_of[$node]}"; done | sort -u | wc -l)
  r=$(pods_of_app tcid "$app" | grep -c . || true)
  if [ "$z" -ge 2 ]; then verdict="OK: survives the loss of one zone"; else verdict="WARNING: every replica is in the same zone"; fi
  echo "$app: $r pod(s) in $z zone(s) -> $verdict"
done

step "4. Disruption budgets (how many pods may be evicted right now)"
k get pdb -n tcid

step "4b. PostgreSQL (CloudNativePG): instances, roles and replication"
primary=$(k get cluster tcid-db -n tcid -o jsonpath='{.status.currentPrimary}')
k get cluster tcid-db -n tcid
for pod in $(k get pods -n tcid -l cnpg.io/podRole=instance,cnpg.io/cluster=tcid-db -o jsonpath='{.items[*].metadata.name}'); do
  node=$(k get pod "$pod" -n tcid -o jsonpath='{.spec.nodeName}')
  role=standby; [ "$pod" = "$primary" ] && role=primary
  echo "$pod  $role  ${zone_of[$node]:-?}"
done
k exec -n tcid "$primary" -c postgres -- psql -tAc   "select 'replication to ' || application_name || ': ' || state || ' (' || sync_state || ')' from pg_stat_replication"

# evict_app_pods <node> [dry]: evicts the tcid and tcid-meet pods of a node through the
# Eviction API, which respects the PodDisruptionBudgets. Autopilot forbids "kubectl drain"
# (it would also evict the managed kube-system pods).
evict_app_pods() {
  local node=$1 dry=${2:-} ns pod q='' out
  [ -n "$dry" ] && q='?dryRun=All'
  for ns in tcid tcid-meet; do
    for pod in $(k get pods -n "$ns" --field-selector "spec.nodeName=$node,status.phase=Running" -o jsonpath='{.items[*].metadata.name}'); do
      if out=$(printf '{"apiVersion":"policy/v1","kind":"Eviction","metadata":{"name":"%s","namespace":"%s"}}' "$pod" "$ns" |
               kubectl create --raw "/api/v1/namespaces/$ns/pods/$pod/eviction$q" -f - 2>&1); then
        echo "    evicted $ns/$pod${dry:+ (dry run)}"
      else
        echo "    refused $ns/$pod: ${out##*: }"
      fi
    done
  done
}

step "5. Impact of losing each zone (simulation, nothing is changed)"
db_zone() {  # <pod>: zone of a database instance
  local node; node=$(k get pod "$1" -n tcid -o jsonpath='{.spec.nodeName}' 2>/dev/null || true)
  echo "${zone_of[$node]:-}"
}
standby=$(k get pods -n tcid -l cnpg.io/podRole=instance,cnpg.io/cluster=tcid-db -o jsonpath='{.items[*].metadata.name}' | tr ' ' '
' | grep -v "^$primary$" | head -1)
for zone in $(printf '%s\n' "${zone_of[@]}" | sort -u); do
  echo "--- if $zone goes down:"
  for app in backend frontend; do
    left=$(pods_of_app tcid "$app" | while read -r _ node; do [ "${zone_of[$node]}" != "$zone" ] && echo x; done | grep -c . || true)
    if [ "$left" -ge 1 ]; then echo "  $app: $left pod(s) keep serving"; else echo "  $app: no pod left until Autopilot recreates them in another zone"; fi
  done
  if [ "$(db_zone "$primary")" = "$zone" ]; then
    if [ -n "$standby" ] && [ "$(db_zone "$standby")" != "$zone" ]; then
      echo "  postgres: the primary $primary is lost; the operator promotes $standby ($(db_zone "$standby"))"
      echo "            and moves tcid-db-rw to it: the API is back after the failover (seconds)."
    else
      echo "  postgres: DOWN, no standby in another zone."
    fi
  else
    echo "  postgres: the primary $primary ($(db_zone "$primary")) keeps running."
  fi
  for n in "${!zone_of[@]}"; do
    [ "${zone_of[$n]}" = "$zone" ] || continue
    echo "  eviction dry-run of the application pods on $n:"
    evict_app_pods "$n" dry
  done
done

# measure <seconds> <label>: requests /api/readyz/ every second, prints the failures
measure() {
  local end=$((SECONDS + $1)) ok=0 ko=0 code
  while [ $SECONDS -lt $end ]; do
    code=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$SITE/api/readyz/") || true
    if [ "$code" = 200 ]; then ok=$((ok + 1)); else ko=$((ko + 1)); echo "  $(date +%H:%M:%S) HTTP $code"; fi
    sleep 1
  done
  echo "$2: $ok OK, $ko failed"
}

if [ "$pod_test" = 1 ]; then
  step "6. Pod test: one backend pod is deleted, the site is measured for 90 s"
  victim=$(k get pods -n tcid -l app=backend -o name | head -1)
  echo "deleting $victim (its Deployment recreates it)"
  ( sleep 5; kubectl -n tcid delete "$victim" --wait=false ) &
  measure 90 "site during the pod test"
  wait
  k get pods -n tcid -l app=backend -o wide
fi

if [ "$db_failover" = 1 ]; then
  step "6b. Database failover: the primary pod $primary is deleted, the site is measured for 120 s"
  echo "No data is deleted: the pod's disk stays, and the standby already holds every committed transaction."
  ( sleep 5; kubectl -n tcid delete pod "$primary" --wait=false ) &
  measure 120 "site during the database failover"
  wait
  k get cluster tcid-db -n tcid
fi

if [ -n "$drill_zone" ]; then
  step "7. Zone drill: loss of $drill_zone"
  nodes=$(for n in "${!zone_of[@]}"; do [ "${zone_of[$n]}" = "$drill_zone" ] && echo "$n"; done)
  [ -n "$nodes" ] || { echo "no node in $drill_zone" >&2; exit 1; }
  echo "Nodes that will be cordoned, then emptied of the application pods: $nodes"
  [ "$(db_zone "$primary")" = "$drill_zone" ] && echo "Note: the PostgreSQL primary is in this zone: the standby will be promoted."
  echo "Pods are evicted (PDBs respected), no data or volume is touched; the nodes are uncordoned at the end."
  read -r -p "Type the zone name to confirm: " answer
  [ "$answer" = "$drill_zone" ] || { echo "cancelled"; exit 1; }
  trap 'for n in $nodes; do kubectl uncordon "$n"; done' EXIT
  for n in $nodes; do kubectl cordon "$n"; done
  ( sleep 5; for n in $nodes; do evict_app_pods "$n"; done ) &
  measure 300 "site during the zone drill"
  wait
  k get pods -n tcid -o wide
fi
echo
echo "Done."
