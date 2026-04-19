FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV TRUST_PROXY=1

EXPOSE 5050
CMD ["node", "src/index.js"]
