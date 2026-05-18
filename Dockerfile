FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && python3 -m pip install --no-cache-dir jc==1.25.6 \
  && python3 -m jc --version \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
CMD ["node", "server.mjs"]
