# Usa Node 20 (más estable para Ionic/Angular)
FROM node:20

# Directorio de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install -g @ionic/cli
RUN npm install

# Copiar resto del proyecto
COPY . .

# Exponer puerto de Ionic
EXPOSE 8100

# Comando para levantar el servidor de desarrollo
CMD ["ionic", "serve", "--host", "0.0.0.0", "--port", "8100", "--disableHostCheck"]
