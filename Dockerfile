FROM node:20-alpine

# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# NestJS outputs to dist/src/main (no rootDir set in tsconfig)
CMD sh -c "npx prisma migrate deploy && npx ts-node prisma/seed.ts || true && node dist/src/main"
