FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev=false && npx tsx --version
ENV PORT=8080
EXPOSE 8080
CMD ["npx","tsx","apps/signaling/src/index.ts"]
