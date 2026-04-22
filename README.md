# UX Research Template — IA para proyectos web de servicios

[English](README.en.md)

Plantilla Next.js para realizar investigación UX en **7 fases** (Research → Understanding → Define → ideación y priorización → arquitectura → interacción → identidad), con generación de análisis mediante IA (OpenAI GPT-4o). El orden canónico vive en `lib/research-journey-steps.ts` y alimenta el dashboard y la barra de recorrido.

Diseñada para proyectos web de **negocios de servicios presenciales**: centros de salud, entrenadores personales, clínicas, estudios, consultorios, etc.

---

## Fases y módulos (orden recomendado)

| Fase | Rutas | Rol |
|------|--------|-----|
| **1. Investigación (Research)** | `/ceo`, `/survey`, `/potential` | Recoger datos sin forzar la interpretación. |
| **2. Síntesis (Understanding)** | `/empathy`, `/insights`, `/user-persona` | Empatía → insights (crítico) → personas. |
| **3. Definición (Define)** | `/pov`, `/hmw`, `/user-journey` | POV → HMW → User Journey por canal (sobre el HMW guardado). |
| **4. Ideación + priorización** | `/moscow`, `/mvp` | MoSCoW desde User Journey + entrevista CEO; luego matriz MVP. |
| **5. Estructura (Arquitectura UX)** | `/mapa-sitio` | Arquitectura de información a partir del MVP guardado. |
| **6. Interacción** | `/user-flow` | Flujo real de navegación (requiere mapa + journey + ideas guardados en Sheets). |
| **7. Identidad y diseño** | `/design` | Principios al cierre o en paralelo al diseño visual. |

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

Yo he vinculado las hojas de calculo generadas desde Google forms. Así las hojas de calculo se van actualizando conforme van llegando respuestas a las encuestas.

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

Orden lineal (14 pasos); la barra superior y el dashboard del proyecto siguen esta secuencia definida en `lib/research-journey-steps.ts`:

```
1. /ceo           → Entrevista CEO (negocio, objetivos, restricciones)
2. /survey        → Encuesta clientes actuales
3. /potential     → Encuesta clientes potenciales
4. /empathy       → Mapa de empatía
5. /insights      → Patrones con IA (crítico antes de personas)
6. /user-persona  → User personas
7. /pov           → Point of View
8. /hmw           → How Might We
9. /user-journey  → User journey por canal (después del HMW)
10. /moscow       → MoSCoW (User Journey + ideas + entrevista CEO)
11. /mvp          → Matriz MVP
12. /mapa-sitio   → Mapa del sitio (arquitectura)
13. /user-flow    → User flow (mapa + journey + ideas guardados)
14. /design       → Principios de diseño
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


Este proyecto nació de la necesidad de mostrar al cliente los resultados de las encuestas y para definir junto al cliente los principios de diseño. Poco a poco fui añadiendo todas las fases UX para ayudarme con el analisis y mostrar al cliente los resultados así poder defender después mis decisiones de diseño.