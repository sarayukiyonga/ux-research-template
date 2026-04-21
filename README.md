# UX Research Template — IA para proyectos web de servicios

Plantilla Next.js para realizar investigación UX completa (encuestas, entrevistas CEO, user personas, empathy maps, HMW, POV, user journey, MoSCoW, MVP y mapa del sitio) con generación de análisis mediante IA (OpenAI GPT-4o).

Diseñada para proyectos web de **negocios de servicios presenciales**: centros de salud, entrenadores personales, clínicas, estudios, consultorios, etc.

---

## Módulos incluidos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard CEO | `/ceo` | Entrevista al fundador/a con análisis IA |
| Encuesta clientes actuales | `/survey` | Resultados y filtros de encuesta de satisfacción |
| Encuesta clientes potenciales | `/potential` | Encuesta de descubrimiento de mercado |
| Insights IA | `/insights` | Síntesis automática de respuestas abiertas |
| Mapa de empatía | `/empathy` | Generado con IA a partir de encuestas + CEO |
| User Persona | `/user-persona` | Perfiles de cliente actual y potencial |
| Point of View | `/pov` | Declaraciones POV (Design Thinking) |
| How Might We | `/hmw` | Preguntas HMW generadas por IA |
| User Journey | `/user-journey` | Mapa de viaje por canal (web, Instagram, etc.) |
| User Flow | `/user-flow` | Flujos de usuario con IA |
| MoSCoW | `/moscow` | Priorización de funcionalidades |
| MVP | `/mvp` | Matriz de valor usuario vs. negocio |
| Mapa del sitio | `/mapa-sitio` | Arquitectura de la web generada con IA |
| Principios de diseño | `/design` | Principios visuales y de comunicación |

---

## Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior
- Cuenta de [OpenAI](https://platform.openai.com/) con acceso a GPT-4o
- Proyecto en [Google Cloud](https://console.cloud.google.com/) con una **Service Account** con acceso a Google Sheets API
- Tres hojas de Google Sheets (ver más abajo)

---

## Empezar desde cero

### 1. Crear el repositorio desde la plantilla

En GitHub, pulsa **"Use this template"** → **"Create a new repository"** y dale el nombre de tu proyecto.

### 2. Clonar y instalar dependencias

```bash
git clone https://github.com/TU-USUARIO/TU-REPO.git
cd TU-REPO
npm install
```

### 3. Configurar las hojas de Google Sheets

Necesitas **tres hojas de cálculo** en Google Sheets (pueden estar en el mismo documento o en documentos separados):

| Variable | Contenido |
|----------|-----------|
| `GOOGLE_SHEETS_ID` | Hoja principal: pestañas `ceo`, `hmw`, `moscow`, `mvp`, `sitemap_moa`, `informe_ceo`, `user_persona`, `pov`, `user_journey`, `user_journey_ideas`, `user_flow`, `design_principles`, `empathy_map_saved` |
| `SURVEY_SHEET_ID` | Hoja de respuestas de la encuesta de clientes actuales |
| `POTENTIAL_SURVEY_SHEET_ID` | Hoja de respuestas de la encuesta de clientes potenciales |

> **Tip:** Comparte cada hoja con el email de tu Service Account dándole permisos de **Editor**.

### 4. Crear la Service Account de Google

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → IAM → Service Accounts
2. Crea una nueva cuenta de servicio
3. Descarga la clave en formato JSON
4. Copia el `client_email` y la `private_key` del JSON

### 5. Configurar las variables de entorno

Copia el archivo de ejemplo y rellena los valores:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-cuenta@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ID=ID_de_tu_hoja_principal
SURVEY_SHEET_ID=ID_de_tu_hoja_encuesta_actuales
POTENTIAL_SURVEY_SHEET_ID=ID_de_tu_hoja_encuesta_potenciales

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Acceso a la app (usuario/contraseña básicos)
AUTH_PASSWORD=elige_una_contrasena_segura
AUTH_SECRET=cadena_aleatoria_de_64_chars  # genera con: openssl rand -hex 32

# Datos del cliente (adapta a cada proyecto)
CLIENT_NAME=NombreDelNegocio
CLIENT_OWNER_FIRST_NAME=Nombre
CLIENT_OWNER_FULL_NAME=Nombre Apellido
CLIENT_OWNER_ROLE=fundador/a y CEO
CLIENT_LOCATION=Ciudad
CLIENT_LOCATION_REGION=Región
CLIENT_SECTOR=salud y bienestar
CLIENT_SERVICE_SHORT=descripción corta
CLIENT_SERVICE_DESCRIPTION=descripción completa del servicio
CLIENT_SERVICE_COMBO=servicio A + servicio B
CLIENT_BRAND_CONCEPT=Concepto de marca
CLIENT_SERVICE_MODEL=presencial
```

> **Importante:** `.env.local` está en `.gitignore` y nunca se sube al repositorio.

### 6. Arrancar en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con la contraseña de `AUTH_PASSWORD`.

---

## Flujo de trabajo recomendado

El orden natural de los módulos sigue el proceso de Design Thinking:

```
1. /ceo          → Entrevista al cliente/fundador
2. /survey       → Resultados encuesta clientes actuales
3. /potential    → Resultados encuesta clientes potenciales
4. /insights     → Síntesis de respuestas con IA
5. /empathy      → Mapa de empatía
6. /user-persona → Perfiles de usuario
7. /pov          → Point of View
8. /hmw          → How Might We
9. /user-journey → Viaje del usuario
10. /user-flow   → Flujos de usuario
11. /moscow      → Priorización MoSCoW
12. /mvp         → Matriz de valor MVP
13. /mapa-sitio  → Arquitectura web
14. /design      → Principios de diseño
```

Cada módulo tiene un botón **"Generar con IA"** que usa el contexto acumulado de los pasos anteriores, y un botón **"Guardar en Sheets"** para persistir los resultados.

---

## Despliegue en Vercel

```bash
npm install -g vercel
vercel
```

O conecta el repositorio directamente desde [vercel.com](https://vercel.com/new) y configura las variables de entorno en **Settings → Environment Variables**.

---

## Adaptar a un nuevo cliente

Solo hay que editar las variables `CLIENT_*` en `.env.local` (o en Vercel). El código no necesita ninguna modificación — todos los prompts de IA se adaptan automáticamente al nombre, sector y descripción del negocio.

---

## Stack tecnológico

- [Next.js 15](https://nextjs.org/) (App Router)
- [OpenAI GPT-4o](https://platform.openai.com/) via [Vercel AI SDK](https://sdk.vercel.ai/)
- [Google Sheets API](https://developers.google.com/sheets/api) como base de datos
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Zod](https://zod.dev/) para validación de esquemas IA
