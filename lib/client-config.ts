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

/** Forma corta para uso en prompts: "MOA (Patri, salud y fitness, Martorell)" */
export const CLIENT_SHORT_DESC =
  `${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.sector}, ${CLIENT.location})`

/** Forma larga: "MOA — centro de osteopatía y movimiento de Patri en Martorell" */
export const CLIENT_LONG_DESC =
  `${CLIENT.name} — ${CLIENT.serviceDescription} de ${CLIENT.ownerFirstName} en ${CLIENT.location}`
