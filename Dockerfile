FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm ci

# Install Chromium + all required Linux dependencies
RUN npx playwright install --with-deps chromium

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]