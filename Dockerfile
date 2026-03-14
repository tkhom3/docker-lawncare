# Stage 1: Build the React frontend
FROM node:22-bookworm-slim AS frontend-build
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Node/Express backend
FROM node:22-bookworm-slim AS backend
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/src ./src
COPY --from=frontend-build /app/frontend/dist ./public
COPY entrypoint.sh /entrypoint.sh

# Create non-root user and pre-create data dir
RUN useradd -m -u 10001 lawncare \
    && mkdir -p /app/data \
    && chown -R lawncare:lawncare /app \
    && chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
