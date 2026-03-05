# Build Stage
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and generate Prisma client
COPY . .
RUN npx prisma generate --schema=libs/database/prisma/schema.prisma --config=libs/database/prisma.config.ts

# Build all applications
RUN npx nest build gateway
RUN npx nest build auth-service
RUN npx nest build kyc-service
RUN npx nest build user-service

# Production Stage
FROM node:22-alpine
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Prisma schema and config and generate client
COPY libs/database/prisma/schema.prisma ./libs/database/prisma/
COPY libs/database/prisma.config.ts ./libs/database/
RUN npx prisma generate --schema=libs/database/prisma/schema.prisma --config=libs/database/prisma.config.ts

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Keep the container running or specify default
CMD ["node", "dist/apps/gateway/main.js"]
