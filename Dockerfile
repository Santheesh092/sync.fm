# ── Stage 1: Build Frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production Server ────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy built frontend to be served statically
COPY --from=frontend-builder /app/frontend/dist ./public

# Install serve for static files or  use express static
RUN npm install express-static || true

EXPOSE 3001

CMD ["node", "server.js"]
