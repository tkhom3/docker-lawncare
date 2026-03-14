# Stage 1: Build the React frontend
FROM node:22-bookworm-slim AS frontend-build
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Node/Express backend
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/src ./src
COPY --from=frontend-build /app/frontend/dist ./public

# Stage 3: Final combined image
FROM node:22-bookworm-slim
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        supervisor \
        gosu \
    && rm -rf /var/lib/apt/lists/*

# Install uv for Python dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Copy Node app
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/src ./src
COPY --from=backend-build /app/public ./public

# Install and copy Python collector
COPY collector/pyproject.toml ./collector/
RUN uv pip install --system --break-system-packages -r /app/collector/pyproject.toml
COPY collector/collector.py ./collector/

# Supervisord config and entrypoint
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh

# Create non-root user and pre-create data dir
RUN useradd -m -u 10001 lawncare \
    && mkdir -p /app/data \
    && chown -R lawncare:lawncare /app \
    && chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
