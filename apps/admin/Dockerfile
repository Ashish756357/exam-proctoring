FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json vite.config.ts ./
COPY src ./src
ARG VITE_API_BASE
ARG VITE_WS_BASE
ARG VITE_ICE_SERVERS_JSON
RUN VITE_API_BASE="$VITE_API_BASE" VITE_WS_BASE="$VITE_WS_BASE" VITE_ICE_SERVERS_JSON="$VITE_ICE_SERVERS_JSON" npm run build
EXPOSE 5175
CMD ["npm", "run", "preview"]
