# Etapa 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias de desarrollo y producción
RUN npm install

# Copy config files
COPY rollup.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./

# Copiar el resto del código de la aplicación
COPY ./src ./src

# Construir la aplicación
RUN npm run build

# Etapa 2: Producción (Runtime)
FROM node:18-alpine AS production

# Setear la variable de entorno para producción
ENV NODE_ENV=production

# Setear el directorio de trabajo en /app
WORKDIR /app

# Copiar solamente las dependencias necesarias para producción
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

# Exponer el puerto de la aplicación
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["npm", "start"]
