FROM oven/bun:1-alpine AS base
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build with Node 22 + Turbopack (matches local build)
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars must be available at build time so Next.js inlines them into
# client bundles. No brand defaults here: the image is brand-agnostic and every
# brand (endpoints + identity) is supplied per build. The brand set is REQUIRED;
# getBrand() fails the build if any value is missing.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BASE_SITE_URL
ARG NEXT_PUBLIC_OAUTH_REDIRECT_URI
ARG NEXT_PUBLIC_BRAND_KEY
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_BRAND_LEGAL_NAME
ARG NEXT_PUBLIC_BRAND_CNPJ
ARG NEXT_PUBLIC_BRAND_SITE_URL
ARG NEXT_PUBLIC_BRAND_DOCS_URL
ARG NEXT_PUBLIC_BRAND_SUPPORT_EMAIL
ARG NEXT_PUBLIC_BRAND_CONTACT_EMAIL
ARG NEXT_PUBLIC_BRAND_DPO_EMAIL
ARG NEXT_PUBLIC_BRAND_PHONE
ARG NEXT_PUBLIC_BRAND_AI_NAME
ARG NEXT_PUBLIC_BRAND_AI_ALIAS_PREFIX
ARG NEXT_PUBLIC_BRAND_CDN_HOST
ARG NEXT_PUBLIC_BRAND_LOGO_URL
ARG NEXT_PUBLIC_BRAND_LOGO_WHITE_URL
ARG NEXT_PUBLIC_BRAND_FAVICON_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_BASE_SITE_URL=$NEXT_PUBLIC_BASE_SITE_URL
ENV NEXT_PUBLIC_OAUTH_REDIRECT_URI=$NEXT_PUBLIC_OAUTH_REDIRECT_URI
ENV NEXT_PUBLIC_BRAND_KEY=$NEXT_PUBLIC_BRAND_KEY
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_BRAND_LEGAL_NAME=$NEXT_PUBLIC_BRAND_LEGAL_NAME
ENV NEXT_PUBLIC_BRAND_CNPJ=$NEXT_PUBLIC_BRAND_CNPJ
ENV NEXT_PUBLIC_BRAND_SITE_URL=$NEXT_PUBLIC_BRAND_SITE_URL
ENV NEXT_PUBLIC_BRAND_DOCS_URL=$NEXT_PUBLIC_BRAND_DOCS_URL
ENV NEXT_PUBLIC_BRAND_SUPPORT_EMAIL=$NEXT_PUBLIC_BRAND_SUPPORT_EMAIL
ENV NEXT_PUBLIC_BRAND_CONTACT_EMAIL=$NEXT_PUBLIC_BRAND_CONTACT_EMAIL
ENV NEXT_PUBLIC_BRAND_DPO_EMAIL=$NEXT_PUBLIC_BRAND_DPO_EMAIL
ENV NEXT_PUBLIC_BRAND_PHONE=$NEXT_PUBLIC_BRAND_PHONE
ENV NEXT_PUBLIC_BRAND_AI_NAME=$NEXT_PUBLIC_BRAND_AI_NAME
ENV NEXT_PUBLIC_BRAND_AI_ALIAS_PREFIX=$NEXT_PUBLIC_BRAND_AI_ALIAS_PREFIX
ENV NEXT_PUBLIC_BRAND_CDN_HOST=$NEXT_PUBLIC_BRAND_CDN_HOST
ENV NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL
ENV NEXT_PUBLIC_BRAND_LOGO_WHITE_URL=$NEXT_PUBLIC_BRAND_LOGO_WHITE_URL
ENV NEXT_PUBLIC_BRAND_FAVICON_URL=$NEXT_PUBLIC_BRAND_FAVICON_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use webpack in Docker for build stability (avoids Turbopack worker SIGSEGV on some Alpine hosts)
RUN --mount=type=cache,target=/app/.next/cache \
    NODE_OPTIONS="--max-old-space-size=4096" ./node_modules/.bin/next build

# Stage 3: Minimal production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN adduser --system --uid 1001 nextjs

# Copy public assets. Normalize modes: COPY preserves the build context's
# permission bits, so a restrictive host umask (e.g. 0027) would otherwise ship
# root-owned 0750 dirs that the non-root runtime user cannot scandir at startup.
COPY --from=builder /app/public ./public
RUN chmod -R a+rX ./public

# Set correct permissions for prerender cache and image cache
RUN mkdir -p .next/cache/images && chown -R nextjs:bun .next

# Copy standalone build output
COPY --from=builder --chown=nextjs:bun /app/.next/standalone ./
COPY --from=builder --chown=nextjs:bun /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]