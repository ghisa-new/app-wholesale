FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

FROM node:20-slim
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/seed.ts ./seed.ts
COPY --from=builder /app/src/lib/db.ts ./src/lib/db.ts
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
