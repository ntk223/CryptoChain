# Stage 1: Build
FROM node:20-alpine AS builder
ARG VITE_API_URL
ARG VITE_APP_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_BASE_URL=$VITE_APP_BASE_URL

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve với Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]