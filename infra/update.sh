#!/bin/bash
# Update the live site (API image and front end) from any machine, WITHOUT the Terraform state.
# The infrastructure already exists; this script only finds it with Azure CLI and pushes new code.
# Use infra/terraform/deploy.sh only to create or change the infrastructure (it needs the state file).
#
#   ./infra/update.sh              API and front end
#   ./infra/update.sh --api-only   API only
#   ./infra/update.sh --web-only   front end only
#
# The DEV subscription name differs between machines: override it with AZ_SUBSCRIPTION,
# for example  AZ_SUBSCRIPTION=dev-meteormadness ./infra/update.sh  (never the PROD subscription).
#
# Needs: az (logged in: az login), docker (running), node 22+ with npm.
set -euo pipefail

SUBSCRIPTION="${AZ_SUBSCRIPTION:-dev}"
case "$SUBSCRIPTION" in
  *prod*|*PROD*) echo "Error: refusing to deploy to a PROD subscription ($SUBSCRIPTION)."; exit 1 ;;
esac
RG_PREFIX="rg-cyberspace-analogues-"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAG="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
WHAT="${1:-all}"

for cmd in az docker npm; do
  command -v "$cmd" >/dev/null || { echo "Error: $cmd is not installed."; exit 1; }
done
az account show >/dev/null 2>&1 || { echo "Error: run 'az login' first."; exit 1; }
if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "Warning: uncommitted changes will be deployed under the tag of the last commit ($TAG)."
fi

# Azure CLI on Windows prints CRLF: strip it everywhere.
q() { az "$@" --subscription "$SUBSCRIPTION" -o tsv | tr -d '\r'; }

RG=$(q group list --query "[?starts_with(name, '$RG_PREFIX')].name | [0]")
[ -n "$RG" ] || { echo "Error: no resource group starting with $RG_PREFIX in subscription $SUBSCRIPTION."; exit 1; }
az extension add --name containerapp --upgrade --only-show-errors >/dev/null 2>&1 || true
ACR_NAME=$(q acr list -g "$RG" --query "[0].name")
ACR_SERVER=$(q acr list -g "$RG" --query "[0].loginServer")
APP_NAME=$(q containerapp list -g "$RG" --query "[0].name")
API_URL="https://$(q containerapp show -n "$APP_NAME" -g "$RG" --query properties.configuration.ingress.fqdn)"
SWA_NAME=$(q staticwebapp list -g "$RG" --query "[0].name")
WEB_URL="https://$(q staticwebapp show -n "$SWA_NAME" -g "$RG" --query defaultHostname)"
echo "Resource group: $RG"
echo "API: $API_URL"
echo "Web: $WEB_URL"

if [ "$WHAT" != "--web-only" ]; then
  IMAGE="$ACR_SERVER/analogues-api:$TAG"
  az acr login --name "$ACR_NAME" --subscription "$SUBSCRIPTION"
  # linux/amd64 on purpose: Azure runs amd64, also when building on an Apple Silicon Mac.
  docker build --platform linux/amd64 -f "$ROOT_DIR/apps/api/Dockerfile" -t "$IMAGE" "$ROOT_DIR"
  docker push "$IMAGE"
  az containerapp update --name "$APP_NAME" --resource-group "$RG" --subscription "$SUBSCRIPTION" --image "$IMAGE" --output none
  echo "API updated to $IMAGE"
fi

if [ "$WHAT" != "--api-only" ]; then
  cd "$ROOT_DIR/apps/web"
  npm ci
  VITE_API_URL="$API_URL" npm run build
  sed "s#__API_ORIGIN__#$API_URL#" staticwebapp.config.template.json > dist/staticwebapp.config.json
  SWA_CLI_DEPLOYMENT_TOKEN=$(q staticwebapp secrets list --name "$SWA_NAME" -g "$RG" --query properties.apiKey)
  export SWA_CLI_DEPLOYMENT_TOKEN
  npx --yes @azure/static-web-apps-cli@2.0.10 deploy ./dist --env production
  echo "Front end updated"
fi

echo
echo "Verify: python3 tools/validation/e2e.py --web $WEB_URL --api $API_URL"
