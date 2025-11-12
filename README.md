# RedBarrio 🏘️

**RedBarrio** es una aplicación móvil híbrida diseñada para la **gestión integral de comunidades y juntas de vecinos**.  
Facilita la comunicación, la organización de eventos, la gestión de espacios comunes y la participación ciudadana a través de una plataforma centralizada.

---

## 📱 Descripción General

Este proyecto está construido con **Ionic (Angular)** para el frontend, **Capacitor** para la compilación nativa, y utiliza **Supabase** como backend (Base de Datos, Autenticación y Edge Functions).

---

## ✨ Características Principales

La aplicación **RedBarrio** incluye las siguientes funcionalidades clave:

- **Autenticación de Usuarios:** Sistema completo de registro, inicio de sesión y recuperación de contraseña.  
- **Gestión de Perfil:** Los usuarios pueden ver y actualizar su información personal.  
- **Muro de Noticias:** Espacio para que la administración publique anuncios y noticias relevantes para la comunidad.  
- **Sistema de Votaciones:** Permite crear votaciones sobre temas de interés y que los vecinos participen de forma digital.  
- **Reserva de Espacios Comunes:** Módulo para ver disponibilidad y solicitar la reserva de espacios (salones, quinchos, etc.).  
- **Solicitud de Certificados:** Formulario para solicitar certificados (por ejemplo, de residencia) a la administración.  
- **Inscripción a Proyectos:** Los vecinos pueden inscribirse en diferentes proyectos o iniciativas comunitarias.  
- **Integración de Pagos (Transbank):** Pasarela de pago para gestionar cobros (gastos comunes o reservas) utilizando **Supabase Edge Functions** para la comunicación con **Transbank**.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|-------------|-------------|
| **Frontend** | Ionic 7+ con Angular 16+ |
| **Backend (BaaS)** | Supabase |
| **Base de Datos** | PostgreSQL |
| **Autenticación** | Supabase Auth |
| **Serverless** | Supabase Edge Functions (Deno) |
| **Plataforma Móvil** | Capacitor (Android/iOS) |
| **Pasarela de Pagos** | Transbank (integrado vía Edge Functions) |

---

## 🚀 Puesta en Marcha (Frontend)

Para ejecutar el proyecto en un entorno de desarrollo:

### 1️⃣ Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/capstone-rn-jf-sd-parte2.git
```

### 2️⃣ Navegar a la carpeta del proyecto

```bash
cd capstone-rn-jf-sd-parte2/redbarrio
```

### 3️⃣ Instalar dependencias de Node.js

```bash
npm install
```

### 4️⃣ Configurar variables de entorno

Copia tus claves de API de Supabase (`URL` y `anon_key`) en el archivo:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  supabaseUrl: 'TU_SUPABASE_URL',
  supabaseKey: 'TU_SUPABASE_ANON_KEY'
};
```

Haz lo mismo en `src/environments/environment.prod.ts` si usas claves de producción.

### 5️⃣ Ejecutar el servidor de desarrollo

```bash
ionic serve
```

Esto abrirá la aplicación en tu navegador en:  
👉 [http://localhost:8100](http://localhost:8100)

---

## 🔧 Configuración del Backend (Supabase)

El backend (incluyendo las funciones de pago) se gestiona con la **Supabase CLI**.

### 1️⃣ Iniciar sesión en Supabase CLI

```bash
supabase login
```

### 2️⃣ Vincular el proyecto Supabase

Obtén el `[PROJECT_ID]` desde la URL de tu dashboard en Supabase.

```bash
cd ../supabase
supabase link --project-ref [PROJECT_ID]
```

### 3️⃣ Desplegar las Edge Functions

Este proyecto usa Edge Functions para simular y confirmar pagos con **Transbank**:

```bash
supabase functions deploy transbank-simular
supabase functions deploy transbank-confirm
```

Asegúrate de configurar las **variables de entorno necesarias** (como las API keys de Transbank) en el dashboard de Supabase.

---

## 📜 Scripts Útiles (Frontend)

Ejecuta estos comandos desde la carpeta `redbarrio/`:

| Comando | Descripción |
|----------|--------------|
| `ionic serve` | Inicia el servidor de desarrollo web |
| `npm run build` | Compila la app web para producción (salida en `www/`) |
| `ionic cap sync` | Sincroniza los cambios del build web con los proyectos nativos |
| `ionic cap run android` | Ejecuta la app en un dispositivo o emulador Android |
| `ionic cap run ios` | Ejecuta la app en un dispositivo o emulador iOS |

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas!  
Si deseas colaborar, abre un **issue** o envía un **pull request** con tus mejoras.

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**.  
Consulta el archivo [LICENSE](./LICENSE) para más información.

---

## 💡 Autor

**RedBarrio** — Proyecto desarrollado como parte del *Capstone* de Ingeniería.  
Construido con ❤️ utilizando *Ionic + Supabase + Transbank*.
