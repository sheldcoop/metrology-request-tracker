# Metrology Request Tracker - server image (Stage A).
# Local only for now: built and run on Docker Desktop, never pushed.
# Build: docker build -t mrt-server:stage-a .
# Run:   docker run -d --name mrt -p 8080:8080 -v mrt-data:/mrt-data mrt-server:stage-a
FROM node:22-alpine

ENV NODE_ENV=production \
  MRT_PORT=8080 \
  MRT_DB=/mrt-data/mrt.sqlite3

WORKDIR /app
COPY index.html ./
COPY js ./js
COPY css ./css
COPY vendor ./vendor
COPY server ./server

RUN mkdir -p /mrt-data && chown -R node:node /mrt-data /app
USER node

EXPOSE 8080
VOLUME /mrt-data

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e "fetch('http://localhost:8080/api/health').then(function (r) { if (!r.ok) process.exit(1); }).catch(function () { process.exit(1); })"

CMD ["node", "server/index.js"]
