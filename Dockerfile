FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

WORKDIR /app/backend
RUN npm install

WORKDIR /app/frontend
RUN npm install

COPY backend/src ./backend/src
COPY frontend/src ./frontend/src
COPY frontend/index.html ./frontend/
COPY frontend/vite.config.js ./frontend/

WORKDIR /app/frontend
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY backend/src ./backend/src
COPY backend/package*.json ./backend/

COPY --from=builder /app/frontend/dist ./frontend/dist

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

WORKDIR /app/backend

CMD ["node", "src/index.js"]
