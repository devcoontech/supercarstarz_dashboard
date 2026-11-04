# Builds the dashboard and serves it with nginx. VITE_API_URL is fixed at build time.
FROM node:24-slim AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package.json package-lock.json ./
# --include=dev keeps the compiler even if NODE_ENV=production reaches this stage as a build argument.
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM nginx:1-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
