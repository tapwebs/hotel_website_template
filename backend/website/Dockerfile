FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build && npm prune --production

EXPOSE 3001

CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/server.js"]
