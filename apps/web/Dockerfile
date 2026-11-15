# Front servi par nginx. Contexte de build = RACINE du dépôt (le front importe data/fixtures) :
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:3001 -t analogues-web .
FROM node:22-slim AS build
ARG VITE_API_URL=http://localhost:3001
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY data /repo/data
COPY apps/web ./
RUN VITE_API_URL="$VITE_API_URL" npm run build

FROM nginx:1.27-alpine
# Origine de l API autorisée par la politique de sécurité du contenu (connect-src).
ENV API_ORIGIN=http://localhost:3001
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
