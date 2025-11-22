# --- STAGE 1: BUILD ---
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build   # genera /app/www

# --- STAGE 2: NGINX ---
FROM nginx:alpine AS final

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/www /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
