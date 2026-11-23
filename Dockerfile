# Production Multi-Stage Dockerfile for Google Cloud Run
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN cd server && npm install --omit=dev
RUN cd client && npm install

# Copy source code
COPY server ./server
COPY client ./client

# Build frontend static assets
RUN cd client && npm run build

# Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root system group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifacts and dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist

# Assign permissions
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Cloud Run healthcheck & entrypoint
CMD ["npm", "start"]
