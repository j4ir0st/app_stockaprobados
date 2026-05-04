#!/bin/sh

# Reemplazar las variables de entorno en la plantilla de Nginx
# Usamos 'API_URL' para el proxy inverso
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Iniciar comando principal (Nginx)
echo "Starting Nginx with API_URL: $API_URL"
exec "$@"
