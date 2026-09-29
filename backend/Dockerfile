# Dramatique API + FFmpeg transcoder. Build context: backend/
#   docker build -t dramatique-api backend

# ── build: compile TypeScript and generate the Prisma client ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ── production dependencies only ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── runtime ──
FROM node:22-bookworm-slim
# ffmpeg/ffprobe for transcoding, openssl for Prisma, tini to reap FFmpeg child processes
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=deps /app/node_modules ./node_modules
# The generated Prisma client (engine built for this Debian/OpenSSL)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
