# One image for both Deployments: `app` runs the Next.js server, `worker` runs
# worker/dist/index.js (see deploy/). Multi-stage so the runtime image is small.

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY web/package.json web/
COPY worker/package.json worker/
RUN npm ci --no-audit --no-fund
COPY shared/ shared/
COPY web/ web/
COPY worker/ worker/
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server (keeps the workspace layout: web/server.js).
COPY --from=build /repo/web/.next/standalone ./
COPY --from=build /repo/web/.next/static ./web/.next/static
COPY --from=build /repo/web/public ./web/public
# Worker bundle (self-contained, no node_modules needed).
COPY --from=build /repo/worker/dist ./worker/dist
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
# The node image's "node" user, by number so runAsNonRoot can check it.
USER 1000
EXPOSE 8080
CMD ["node", "web/server.js"]
