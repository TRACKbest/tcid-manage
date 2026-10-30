#!/usr/bin/env bash
# Load test: 150 virtual users for about 8 minutes against nginx and the API,
# from inside the cluster (Cloudflare and the internet are not involved).
# Shows the autoscalers adding pods, then removes the test resources.
#
#   ./infra/load-test.sh
#
# Follow it in a second terminal:  kubectl get hpa -n tcid -w
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
manifest="$root/k8s/tests/load-test.yaml"
cleanup() { kubectl delete -f "$manifest" --ignore-not-found --wait=false >/dev/null; }
trap cleanup EXIT

kubectl delete -f "$manifest" --ignore-not-found --wait=true >/dev/null
kubectl apply -f "$manifest"
kubectl -n tcid wait --for=condition=ready pod -l app=load-test --timeout=300s

end=$((SECONDS + 600))
while [ $SECONDS -lt $end ]; do
  printf '\n%s\n' "$(date +%H:%M:%S)"
  kubectl get hpa -n tcid --no-headers
  kubectl -n tcid get job load-test -o jsonpath='{.status.succeeded}{.status.failed}' | grep -q 1 && break
  sleep 30
done

echo; echo "==> k6 summary"
kubectl -n tcid logs job/load-test --tail=40
echo; echo "Pods scale back down by one every 2 minutes after a 5 minute wait."
