# AssetFlow web app: build once, configure at start-up.
#
#   docker build -t assetflow .
#   docker run -p 8080:80 -e PUBLIC_SUPABASE_URL=https://db.example.com -e PUBLIC_SUPABASE_KEY=<anon key> assetflow
#
# The same image works for any company: the database address and public key are read when the
# container starts (see docker/entrypoint.sh), not baked into the build.

FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.20.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/entrypoint.sh /docker-entrypoint.d/40-assetflow-config.sh
RUN chmod +x /docker-entrypoint.d/40-assetflow-config.sh
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
