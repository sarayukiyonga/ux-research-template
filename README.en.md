# UX Research Template — AI for service-business web projects

[← Español](README.md)

Next.js template for UX research in **7 phases** (Research → Understanding → Define → ideation and prioritization → architecture → interaction → identity), with AI-generated analysis (OpenAI GPT-4o). The canonical order lives in `lib/research-journey-steps.ts` and powers the dashboard and the journey bar.

Built for **in-person service business** web projects: health centers, personal trainers, clinics, studios, practices, etc.

---

## Phases and modules (recommended order)

| Phase | Routes | Role |
|------|--------|------|
| **1. Research** | `/ceo`, `/survey`, `/potential` | Collect data without forcing interpretation. |
| **2. Understanding** | `/empathy`, `/insights`, `/user-persona` | Empathy → insights (critical) → personas. |
| **3. Define** | `/pov`, `/hmw`, `/user-journey` | POV → HMW → User journey by channel (based on saved HMW). |
| **4. Ideation + prioritization** | `/moscow`, `/mvp` | MoSCoW from User Journey + CEO interview; then MVP matrix. |
| **5. Structure (UX architecture)** | `/mapa-sitio` | Information architecture from the saved MVP. |
| **6. Interaction** | `/user-flow` | Real navigation flow (requires map + journey + ideas saved in Sheets). |
| **7. Identity and design** | `/design` | Principles at wrap-up or in parallel with visual design. |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [OpenAI](https://platform.openai.com/) account with access to GPT-4o
- [Google Cloud](https://console.cloud.google.com/) project with a **Service Account** that has access to the Google Sheets API
- Three Google Sheets (see below)

---

## Starting from scratch

### 1. Create the repository from the template

On GitHub, click **"Use this template"** → **"Create a new repository"** and name your project.

### 2. Clone and install dependencies

```bash
git clone https://github.com/YOUR-USER/YOUR-REPO.git
cd YOUR-REPO
npm install
```

### 3. Set up Google Sheets

You need **three spreadsheets** in Google Sheets (same workbook or separate files):

I linked spreadsheets generated from Google Forms so they update automatically as survey responses come in.

| Variable | Contents |
|----------|-----------|
| `GOOGLE_SHEETS_ID` | Main sheet: tabs `ceo`, `hmw`, `moscow`, `mvp`, `sitemap_moa`, `informe_ceo`, `user_persona`, `pov`, `user_journey`, `user_journey_ideas`, `user_flow`, `design_principles`, `empathy_map_saved` |
| `SURVEY_SHEET_ID` | Responses sheet for the current-customer survey |
| `POTENTIAL_SURVEY_SHEET_ID` | Responses sheet for the potential-customer survey |

> **Tip:** Share each sheet with your Service Account email and grant **Editor** access.

### 4. Create the Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → IAM → Service Accounts
2. Create a new service account
3. Download the JSON key
4. Copy `client_email` and `private_key` from the JSON

### 5. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ID=your_main_sheet_id
SURVEY_SHEET_ID=your_current_customers_survey_sheet_id
POTENTIAL_SURVEY_SHEET_ID=your_potential_customers_survey_sheet_id

# OpenAI
OPENAI_API_KEY=sk-proj-...

# App access (basic username/password)
AUTH_PASSWORD=choose_a_strong_password
AUTH_SECRET=random_64_char_string  # generate with: openssl rand -hex 32

# Client data (adjust per project)
CLIENT_NAME=BusinessName
CLIENT_OWNER_FIRST_NAME=FirstName
CLIENT_OWNER_FULL_NAME=FirstName LastName
CLIENT_OWNER_ROLE=founder and CEO
CLIENT_LOCATION=City
CLIENT_LOCATION_REGION=Region
CLIENT_SECTOR=health and wellness
CLIENT_SERVICE_SHORT=short description
CLIENT_SERVICE_DESCRIPTION=full service description
CLIENT_SERVICE_COMBO=service A + service B
CLIENT_BRAND_CONCEPT=Brand concept
CLIENT_SERVICE_MODEL=in-person
```

> **Important:** `.env.local` is in `.gitignore` and is never committed to the repository.

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the password from `AUTH_PASSWORD`.

---

## Recommended workflow

Linear order (14 steps); the top bar and project dashboard follow this sequence defined in `lib/research-journey-steps.ts`:

```
1. /ceo           → CEO interview (business, goals, constraints)
2. /survey        → Current-customer survey
3. /potential     → Potential-customer survey
4. /empathy       → Empathy map
5. /insights      → AI patterns (critical before personas)
6. /user-persona  → User personas
7. /pov           → Point of View
8. /hmw           → How Might We
9. /user-journey  → User journey by channel (after HMW)
10. /moscow       → MoSCoW (User Journey + ideas + CEO interview)
11. /mvp          → MVP matrix
12. /mapa-sitio   → Site map (architecture)
13. /user-flow    → User flow (map + journey + ideas saved)
14. /design       → Design principles
```

Each module has an **"Generate with AI"** button that uses accumulated context from previous steps, and a **"Save to Sheets"** button to persist results.

---

## Deploy on Vercel

```bash
npm install -g vercel
vercel
```

Or connect the repository directly from [vercel.com](https://vercel.com/new) and set environment variables under **Settings → Environment Variables**.

---

## Adapting for a new client

Edit the `CLIENT_*` variables in `.env.local` (or in Vercel). No code changes are required — all AI prompts adapt automatically to the business name, sector, and description.

---

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [OpenAI GPT-4o](https://platform.openai.com/) via [Vercel AI SDK](https://sdk.vercel.ai/)
- [Google Sheets API](https://developers.google.com/sheets/api) as the database
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Zod](https://zod.dev/) for AI schema validation

This project started from the need to show clients survey results and to define design principles together with the client. Over time I added every UX phase to help with analysis, show clients the results, and better justify later design decisions.
