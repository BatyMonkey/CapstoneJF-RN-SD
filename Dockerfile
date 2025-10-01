# Usa Node (mejor 18 o 20 para Angular/Ionic)
FROM node:20

# Directorio de trabajo
WORKDIR /app

# Copia dependencias
COPY package*.json ./
RUN npm install -g @ionic/cli
RUN npm install

# Copia el resto del proyecto
COPY . .

# Expone puerto de ionic serve
EXPOSE 8100

# Comando para levantar la app en dev (¡AQUÍ ESTÁ EL CAMBIO!)
CMD ["ionic", "serve", "--host", "0.0.0.0", "--port", "8100", "--disableHostCheck", "--poll=500"]