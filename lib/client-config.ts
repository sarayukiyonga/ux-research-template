/**
 * Configuración del cliente — **solo lectura de `process.env`** (`CLIENT_*`).
 *
 * No hace falta (ni conviene) editar este archivo por proyecto: copia
 * `.env.example` → `.env.local` y rellena ahí los datos (o las variables en
 * Vercel). Los valores por defecto del segundo argumento de `env()` son solo
 * marcadores neutros por si falta una variable (p. ej. arranque sin `.env`);
 * no sustituyen a un `.env` completo en producción.
 *
 * Lista de claves: ver `.env.example`.
 */

function env(key: string, placeholderIfUnset: string): string {
  const raw = process.env[key]
  const v = typeof raw === 'string' ? raw.trim() : ''
  return v !== '' ? v : placeholderIfUnset
}

/** Variable opcional: cadena vacía = no definida (se usa el derivado). */
function envOptional(key: string): string | undefined {
  const raw = process.env[key]
  if (typeof raw !== 'string') return undefined
  const v = raw.trim()
  return v !== '' ? v : undefined
}

/** Prefijo seguro para nombres de archivo PDF (ASCII). */
function slugForPdfBasename(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'proyecto'
}

/** Marcadores genéricos si aún no hay `CLIENT_*` en el entorno (no son datos reales). */
const PLACEHOLDER = {
  name: 'Tu negocio',
  ownerFirstName: 'Nombre',
  ownerFullName: 'Nombre Apellido',
  ownerRole: 'fundador/a y CEO',
  location: 'Ciudad',
  locationRegion: 'Región',
  sector: 'sector o industria',
  serviceShort: 'descripción corta del servicio',
  serviceDescription: 'descripción del servicio',
  serviceCombo: 'servicio A + servicio B',
  brandConcept: 'Concepto de marca',
  serviceModel: 'presencial',
} as const

export const CLIENT = {
  name: env('CLIENT_NAME', PLACEHOLDER.name),
  ownerFirstName: env('CLIENT_OWNER_FIRST_NAME', PLACEHOLDER.ownerFirstName),
  ownerFullName: env('CLIENT_OWNER_FULL_NAME', PLACEHOLDER.ownerFullName),
  ownerRole: env('CLIENT_OWNER_ROLE', PLACEHOLDER.ownerRole),
  location: env('CLIENT_LOCATION', PLACEHOLDER.location),
  locationRegion: env('CLIENT_LOCATION_REGION', PLACEHOLDER.locationRegion),
  sector: env('CLIENT_SECTOR', PLACEHOLDER.sector),
  serviceShort: env('CLIENT_SERVICE_SHORT', PLACEHOLDER.serviceShort),
  serviceDescription: env('CLIENT_SERVICE_DESCRIPTION', PLACEHOLDER.serviceDescription),
  serviceCombo: env('CLIENT_SERVICE_COMBO', PLACEHOLDER.serviceCombo),
  brandConcept: env('CLIENT_BRAND_CONCEPT', PLACEHOLDER.brandConcept),
  serviceModel: env('CLIENT_SERVICE_MODEL', PLACEHOLDER.serviceModel),
} as const

/**
 * Prefijo para nombres de PDF descargables (`${CLIENT_PDF_BASENAME}-user-persona.pdf`, etc.).
 * Opcional en `.env`: si no se define, se deriva de `CLIENT_NAME`.
 */
export const CLIENT_PDF_BASENAME = envOptional('CLIENT_PDF_BASENAME') ?? slugForPdfBasename(CLIENT.name)

/** `id` del contenedor que captura html2canvas / exportación PDF (mismo valor en todas las páginas exportables). */
export const PDF_CAPTURE_ROOT_ID = 'research-pdf-root' as const

/** Forma corta para uso en prompts: "Nombre del negocio (dueño/a, sector, ciudad)" */
export const CLIENT_SHORT_DESC =
  `${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.sector}, ${CLIENT.location})`

/** Forma larga: "Nombre — descripción del servicio de dueño/a en ciudad" */
export const CLIENT_LONG_DESC =
  `${CLIENT.name} — ${CLIENT.serviceDescription} de ${CLIENT.ownerFirstName} en ${CLIENT.location}`
