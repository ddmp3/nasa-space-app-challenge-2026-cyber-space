#!/bin/bash
# Déploiement Azure (DEV) : infrastructure Terraform, image de l'API, build du front.
set -euo pipefail

SUBSCRIPTION="dev-meteormadness"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT_DIR/infra/terraform"
TAG="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"

for cmd in terraform az docker npm; do
  command -v "$cmd" >/dev/null || { echo "Erreur : $cmd n'est pas installé."; exit 1; }
done

az account show >/dev/null 2>&1 || { echo "Erreur : lancez d'abord 'az login'."; exit 1; }
az account set --subscription "$SUBSCRIPTION"
echo "Souscription : $(az account show --query name -o tsv)"

cd "$TF_DIR"
terraform init
terraform validate
terraform plan -out=tfplan

read -r -p "Appliquer ces changements ? (yes/no) : " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Déploiement annulé."; exit 0; }
terraform apply tfplan

RG=$(terraform output -raw resource_group_name)
ACR_NAME=$(terraform output -raw container_registry_name)
ACR_SERVER=$(terraform output -raw container_registry_login_server)
APP_NAME=$(terraform output -raw container_app_name)
API_URL=$(terraform output -raw api_url)
WEB_URL=$(terraform output -raw web_url)
IMAGE="$ACR_SERVER/analogues-api:$TAG"

az acr login --name "$ACR_NAME"
docker build --platform linux/amd64 -f "$ROOT_DIR/apps/api/Dockerfile" -t "$IMAGE" "$ROOT_DIR"  # contexte = racine (l'image embarque data/)
docker push "$IMAGE"
az containerapp update --name "$APP_NAME" --resource-group "$RG" --image "$IMAGE"

cd "$ROOT_DIR/apps/web"
npm ci
VITE_API_URL="$API_URL" npm run build
# En-têtes de sécurité du front (même politique que apps/web/nginx en local), avec l'origine réelle de l'API.
sed "s#__API_ORIGIN__#$API_URL#" staticwebapp.config.template.json > dist/staticwebapp.config.json
SWA_TOKEN=$(terraform -chdir="$TF_DIR" output -raw web_deployment_token)
npx --yes @azure/static-web-apps-cli@2.0.10 deploy ./dist --deployment-token "$SWA_TOKEN" --env production

echo "API : $API_URL"
echo "Web : $WEB_URL"
echo "Vérifier : python3 tools/validation/e2e.py --web $WEB_URL --api $API_URL"
