# Etapa 1: Construcción
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Etapa 2: Servidor
FROM nginx:alpine
# Crear el directorio para que coincida con el subpath
RUN mkdir -p /usr/share/nginx/html/app_stockaprobados
COPY --from=build /app/dist/app-stock-aprobados-frontend/browser /usr/share/nginx/html/app_stockaprobados
# Copiar configuración de Nginx (plantilla para envsubst)
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
