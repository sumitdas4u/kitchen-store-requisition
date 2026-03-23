# Stage 1: build both apps
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared packages/shared

RUN npm ci

# Copy source
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend

# Ensure optional public assets directory exists for Docker copy steps
RUN mkdir -p apps/frontend/public

# Build backend
RUN npm --workspace apps/backend run build

# Build frontend
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm --workspace apps/frontend run build

# Stage 2: production image
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared packages/shared

RUN npm ci --omit=dev

COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/frontend/.next apps/frontend/.next
COPY --from=builder /app/apps/frontend/public apps/frontend/public
COPY --from=builder /app/apps/frontend/next.config.mjs apps/frontend/next.config.mjs

EXPOSE 3000 3001

CMD ["sh", "-c", "node apps/backend/dist/main.js & npm --workspace apps/frontend run start -- --hostname 0.0.0.0 -p 3000"]
