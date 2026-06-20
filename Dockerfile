# Stage 1: Install all dependencies (dev included for build tools)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client generation does not require a live DB connection.
# DATABASE_URL is a dummy value solely to satisfy prisma.config.ts env() at parse time.
RUN DATABASE_URL="postgresql://x:x@localhost/x" npx prisma generate

# Build-time dummy environment variables.
# Next.js loads each route module during "page data collection",
# which triggers Prisma client initialization and Auth.js config parsing.
# These values are NOT baked into the runtime image — real values are
# injected at runtime via compose.yml env_file.
RUN DATABASE_URL="postgresql://x:x@localhost/x" \
    AUTH_SECRET="dummy-secret-for-build-only" \
    AUTH_URL="http://localhost:3000" \
    AUTH_TRUST_HOST="true" \
    AUTH_GOOGLE_ID="dummy-google-id" \
    AUTH_GOOGLE_SECRET="dummy-google-secret" \
    NEXTAUTH_URL="http://localhost:3000" \
    NEXTAUTH_SECRET="dummy-nextauth-secret" \
    npm run build

# Stage 3: Production runner (minimal image)
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Tokyo \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]