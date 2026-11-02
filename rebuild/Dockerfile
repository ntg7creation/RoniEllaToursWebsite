# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/src/ backend/src/
COPY backend/tsconfig.json backend/tsconfig.json
COPY frontend/ frontend/
RUN npm run build

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev && npm cache clean --force

FROM ${NODE_IMAGE} AS backend
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/content/ ./backend/content/
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=12s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/ready',{signal:AbortSignal.timeout(10000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/server.js"]

FROM ${NODE_IMAGE} AS frontend
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/frontend/build ./frontend/build
USER node
WORKDIR /app/frontend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health',{signal:AbortSignal.timeout(13000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "../node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]
