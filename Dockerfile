# ── Stage 1: build both apps ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for layer-cache efficiency
COPY package.json package-lock.json ./
COPY apps/backend/package.json  apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared             packages/shared

RUN npm install

# Copy source
COPY apps/backend  apps/backend
COPY apps/frontend apps/frontend

# Build NestJS backend
RUN npm --workspace apps/backend run build

# Build Next.js frontend (NEXT_PUBLIC vars must be baked in at build time)
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm --workspace apps/frontend run build

# ── Stage 2: lean production image ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json  apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared             packages/shared

RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/apps/backend/dist          apps/backend/dist
COPY --from=builder /app/apps/frontend/.next        apps/frontend/.next
COPY --from=builder /app/apps/frontend/public       apps/frontend/public
COPY --from=builder /app/apps/frontend/next.config.mjs apps/frontend/next.config.mjs

EXPOSE 3000 3001

# Start backend (port 3001) and frontend (port 3000) in the same container
CMD ["sh","-c", \
  "node apps/backend/dist/main.js & \
   node node_modules/next/dist/bin/next start apps/frontend -p 3000 -H 0.0.0.0"]
