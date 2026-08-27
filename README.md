# UDELAS AI Learning Platform — MVP

Plataforma de aprendizaje con Inteligencia Artificial, desarrollada como **MVP funcional** para
la Universidad Especializada de las Américas (UDELAS), en el marco del programa institucional
**UDELAS AI University 2026-2045** (Fase I — Fundación Digital).

Este MVP es el primer paso concreto y desplegable del proyecto **"UDELAS AI Learning Platform"**
descrito en el documento de visión institucional, y sirve como base de prueba en servidor real
antes de escalar hacia la arquitectura completa (Strapi, Qdrant, Keycloak, ERPNext, etc.).

---

## 1. ¿Qué incluye este MVP?

A diferencia de un prototipo visual estático, esta es una **aplicación full-stack real**, con
base de datos persistente, autenticación real y conexión real a un modelo de IA (Claude o
OpenAI, a elección).

| # | Módulo | Descripción | Datos |
|---|--------|-------------|-------|
| 1 | **Dashboard** | Resumen de progreso, próximos eventos y recomendaciones | Real (BD) |
| 2 | **Mis cursos** | Cursos matriculados con progreso | Real (BD) |
| 3 | **Calendario** | Eventos académicos del estudiante | Real (BD) |
| 4 | **Calificaciones** | Notas por curso y promedio | Real (BD) |
| 5 | **Tutor IA (UALE)** | Chat con IA real, con contexto académico del estudiante | IA real |
| 6 | **Agentes docentes** | 5 agentes especializados (preguntas, rúbricas, guías, feedback, asesoría) | IA real |
| 7 | **Exámenes IA** | Generación de exámenes con IA, evaluación automática | IA real + BD |
| 8 | **Biblioteca IA** | Búsqueda + síntesis con IA sobre documentos institucionales (RAG básico) | IA real + BD |
| 9 | **Microcredenciales** | Ruta de progreso por pasos | Real (BD) |
| 10 | **Portafolio** | Evidencias del estudiante (creación real) | Real (BD) |
| 11 | **Credenciales digitales** | Insignias tipo Open Badges | Real (BD) |
| 12 | **Analíticas** | Gráficas de progreso, notas y uso del Tutor IA | Real (BD) |

### Sobre el "RAG institucional" en este MVP

El documento de visión plantea un RAG completo con **Qdrant + pgvector**. Para este MVP se
implementó una versión simplificada pero funcional: búsqueda por palabras clave en PostgreSQL
sobre `LibraryDocument`, cuyos resultados se envían como contexto a la IA para que sintetice
una respuesta citando las fuentes. Esto valida el flujo completo (buscar → sintetizar → citar)
sin requerir infraestructura vectorial adicional. La migración a Qdrant/pgvector es un paso
natural de la Fase II sin cambios de arquitectura mayores (ver sección 7).

---

## 2. Stack tecnológico

- **Framework:** Next.js 14 (App Router, TypeScript) — un solo servicio para frontend + API
- **Base de datos:** PostgreSQL, vía Prisma ORM
- **Autenticación:** NextAuth.js (credenciales, sesión JWT)
- **IA:** Adaptador propio (`src/lib/ai.ts`) que llama directamente a la API de **Anthropic
  (Claude)** o de **OpenAI**, según la variable de entorno configurada
- **UI:** Tailwind CSS + lucide-react (iconos) + Recharts (gráficas)
- **Despliegue objetivo:** Render (Web Service + PostgreSQL administrado)

Se eligió deliberadamente **un único servicio Next.js** (en vez de separar frontend/Strapi/
backend) para que el MVP se pueda desplegar en Render en un solo paso, de forma económica y
rápida de probar. Es la base sobre la que se puede evolucionar hacia el stack completo del
plan institucional.

---

## 3. Ejecutar en local

### Requisitos
- Node.js 18.18 o superior
- PostgreSQL (local, Docker, o una instancia gratuita en Render/Neon/Supabase)
- Una API key de Claude (Anthropic) o de OpenAI

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env y completa DATABASE_URL, NEXTAUTH_SECRET y ANTHROPIC_API_KEY (u OPENAI_API_KEY)

# 3. Crear las tablas en la base de datos
npx prisma db push

# 4. Cargar datos de demostración (usuarios, cursos, notas, biblioteca, etc.)
npm run db:seed

# 5. Levantar el servidor de desarrollo
npm run dev
```

Abre `http://localhost:3000` e inicia sesión con una de las cuentas de demostración:

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Estudiante | `carlos@udelas.ac.pa` | `demo1234` |
| Docente | `profesora@udelas.ac.pa` | `demo1234` |

---

## 4. Subir el proyecto a GitHub

```bash
cd udelas-ai-learning-platform
git init
git add .
git commit -m "MVP inicial: UDELAS AI Learning Platform"

# Crea el repositorio vacío en GitHub primero (github.com/new), luego:
git branch -M main
git remote add origin https://github.com/<tu-usuario>/udelas-ai-learning-platform.git
git push -u origin main
```

> El archivo `.env` **nunca** se sube (ya está en `.gitignore`). Las claves de IA y la base de
> datos se configuran directamente en Render, no en el repositorio.

---

## 5. Desplegar en Render

Este proyecto incluye `render.yaml`, un **Blueprint** que crea automáticamente el servicio web
y la base de datos PostgreSQL con un solo clic.

### Opción A — Despliegue con Blueprint (recomendado)

1. Entra a [render.com](https://render.com) y crea una cuenta (o inicia sesión).
2. Ve a **New → Blueprint**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio `udelas-ai-learning-platform`.
4. Render detectará `render.yaml` y mostrará dos recursos a crear:
   - `udelas-ai-platform-db` (PostgreSQL)
   - `udelas-ai-learning-platform` (Web Service)
5. Antes de confirmar, Render te pedirá los valores de las variables marcadas como privadas:
   - `NEXTAUTH_URL`: la URL que Render te va a asignar, ej.
     `https://udelas-ai-learning-platform.onrender.com` (puedes dejarla vacía y editarla
     después del primer deploy, luego el servicio se reinicia solo)
   - `ANTHROPIC_API_KEY` **o** `OPENAI_API_KEY`: tu clave de IA
6. Haz clic en **Apply**. Render instalará dependencias, generará Prisma Client, creará las
   tablas (`prisma db push`) y compilará la aplicación.
7. Cuando el estado sea **Live**, entra a la URL del servicio.

### Opción B — Despliegue manual (sin Blueprint)

1. **New → PostgreSQL** → crea la base de datos → copia el "Internal Database URL".
2. **New → Web Service** → conecta el repositorio.
   - Runtime: `Node`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
3. En la pestaña **Environment**, agrega las variables descritas en `.env.example`
   (`DATABASE_URL` con la URL copiada en el paso 1, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
   `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`).
4. Despliega.

### Cargar los datos de demostración en Render

Después del primer despliegue exitoso, abre la pestaña **Shell** del servicio web en Render y
ejecuta:

```bash
npm run db:seed
```

Esto crea las cuentas de demostración y el contenido inicial (cursos, calificaciones, biblioteca,
microcredenciales, badges) directamente en la base de datos de producción, para poder probar la
plataforma de inmediato.

---

## 6. Variables de entorno

Ver `.env.example` para la lista completa y comentada. Resumen:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL |
| `NEXTAUTH_SECRET` | Sí | Clave para firmar sesiones (genera con `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Sí | URL pública del sitio |
| `ANTHROPIC_API_KEY` | Una de las dos | Habilita el Tutor IA con Claude |
| `OPENAI_API_KEY` | Una de las dos | Habilita el Tutor IA con OpenAI |

Si ninguna clave de IA está configurada, la aplicación **sigue funcionando** (dashboard, cursos,
calificaciones, calendario, portafolio, badges, analíticas), pero el Tutor IA, los Agentes
docentes, el generador de exámenes y la síntesis de la Biblioteca IA responderán con un mensaje
claro indicando que falta la configuración, en vez de fallar de forma silenciosa.

---

## 7. Alcance del MVP vs. la visión institucional completa

Este MVP corresponde al **Proyecto 2 de la Fase I (2026-2028)** del programa
*UDELAS AI University 2026-2045*: **"UDELAS AI Learning Platform"**. Se construyó con alcance
deliberadamente acotado para poder probarse en un servidor real en días, no meses:

| Componente en la visión institucional | En este MVP |
|---|---|
| Next.js + Strapi (CMS headless) | Next.js con datos en PostgreSQL vía Prisma (sin Strapi todavía) |
| Qdrant + pgvector (RAG vectorial) | Búsqueda por texto en PostgreSQL + síntesis con IA |
| Keycloak (SSO institucional) | NextAuth con credenciales propias |
| BigBlueButton (videoconferencia) | No incluido en este MVP |
| H5P (contenido interactivo) | No incluido en este MVP |
| Open Badges (estándar formal) | Modelo de datos equivalente, sin el estándar formal aún |
| ERPNext / integración académica | No incluido en este MVP |
| Kubernetes / Docker | Despliegue directo en Render (Node) |

Este enfoque permite **validar con usuarios reales de UDELAS** (docentes y estudiantes) el
valor del Tutor IA, los Agentes docentes y los demás módulos, antes de invertir en la
infraestructura completa de la Fase II en adelante. La migración de cada componente simplificado
a su versión institucional completa no requiere rehacer la aplicación: se reemplaza pieza por
pieza (ej. cambiar la búsqueda por texto por Qdrant en `src/app/api/library/search/route.ts`
sin tocar el resto del sistema).

---

## 8. Estructura del proyecto

```
udelas-ai-learning-platform/
├── prisma/
│   ├── schema.prisma       # Modelo de datos completo
│   └── seed.ts             # Datos de demostración
├── src/
│   ├── app/
│   │   ├── (app)/          # Rutas protegidas (los 12 módulos)
│   │   ├── api/            # Rutas API (auth, chat IA, exámenes, biblioteca, portafolio)
│   │   ├── login/
│   │   └── layout.tsx
│   ├── components/         # Componentes de UI reutilizables
│   ├── lib/                 # Prisma client, NextAuth config, adaptador de IA
│   └── middleware.ts        # Protección de rutas
├── render.yaml              # Blueprint de despliegue en Render
├── .env.example
└── package.json
```

---

## 9. Seguridad y buenas prácticas ya aplicadas

- Contraseñas con hash `bcrypt` (nunca en texto plano)
- Sesiones firmadas (JWT) vía NextAuth
- Todas las rutas de módulos protegidas por middleware; sin sesión, redirige a `/login`
- Las API keys de IA viven solo en variables de entorno del servidor, nunca en el cliente
- Cada respuesta de IA queda registrada en `ChatMessage` para trazabilidad académica

## 10. Próximos pasos sugeridos (fuera de alcance de este MVP)

1. Pruebas piloto con un grupo reducido de estudiantes y docentes de UDELAS.
2. Autenticación institucional real (SSO / Keycloak) en vez de credenciales propias.
3. Migrar la Biblioteca IA a RAG vectorial (Qdrant o pgvector) con el repositorio institucional real.
4. Panel de administración para que CTE+i/DSPVI gestionen cursos, usuarios y contenido sin tocar código.
5. Métricas de adopción para alimentar los indicadores de la Hoja de Ruta SPVI 2026-2029.
