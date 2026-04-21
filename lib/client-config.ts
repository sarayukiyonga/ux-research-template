/**
 * Configuración del cliente — único punto donde se definen todos los datos
 * específicos del proyecto. Para un nuevo proyecto, edita las variables de
 * entorno en .env.local (o en Vercel/Netlify) y este archivo no necesita tocarse.
 *
 * Variables de entorno necesarias (ver .env.example):
 *   CLIENT_NAME                – nombre comercial corto           e.g. "MOA"
 *   CLIENT_OWNER_FIRST_NAME    – nombre informal del propietario   e.g. "Patri"
 *   CLIENT_OWNER_FULL_NAME     – nombre completo                  e.g. "Patricia Dorado"
 *   CLIENT_OWNER_ROLE          – rol en la empresa                e.g. "fundadora y CEO"
 *   CLIENT_LOCATION            – ciudad principal                 e.g. "Martorell"
 *   CLIENT_LOCATION_REGION     – región/comarca                   e.g. "Baix Llobregat"
 *   CLIENT_SECTOR              – sector/industria                 e.g. "salud y fitness"
 *   CLIENT_SERVICE_SHORT       – descripción corta del servicio   e.g. "osteopatía y movimiento"
 *   CLIENT_SERVICE_DESCRIPTION – descripción completa             e.g. "centro de osteopatía y movimiento"
 *   CLIENT_SERVICE_COMBO       – servicios combinados             e.g. "ejercicio + osteopatía + fisio"
 *   CLIENT_BRAND_CONCEPT       – concepto de marca                e.g. "Salud en Movimiento"
 *   CLIENT_SERVICE_MODEL       – modelo presencial/digital        e.g. "presencial"
 *   GOOGLE_SHEETS_ID           – ID de la hoja de Google Sheets
 */

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const CLIENT = {
  name:               env('CLIENT_NAME',               'MOA'),
  ownerFirstName:     env('CLIENT_OWNER_FIRST_NAME',   'Patri'),
  ownerFullName:      env('CLIENT_OWNER_FULL_NAME',    'Patricia Dorado'),
  ownerRole:         env('CLIENT_OWNER_ROLE',          'fundadora y CEO'),
  location:           env('CLIENT_LOCATION',           'Martorell'),
  locationRegion:     env('CLIENT_LOCATION_REGION',    'Baix Llobregat'),
  sector:             env('CLIENT_SECTOR',             'salud y fitness'),
  serviceShort:       env('CLIENT_SERVICE_SHORT',      'osteopatía y movimiento'),
  serviceDescription: env('CLIENT_SERVICE_DESCRIPTION','centro de osteopatía y movimiento'),
  serviceCombo:       env('CLIENT_SERVICE_COMBO',      'ejercicio + osteopatía + fisio'),
  brandConcept:       env('CLIENT_BRAND_CONCEPT',      'Salud en Movimiento'),
  serviceModel:       env('CLIENT_SERVICE_MODEL',      'presencial'),
} as const

/** Forma corta para uso en prompts: "MOA (Patri, salud y fitness, Martorell)" */
export const CLIENT_SHORT_DESC =
  `${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.sector}, ${CLIENT.location})`

/** Forma larga: "MOA — centro de osteopatía y movimiento de Patri en Martorell" */
export const CLIENT_LONG_DESC =
  `${CLIENT.name} — ${CLIENT.serviceDescription} de ${CLIENT.ownerFirstName} en ${CLIENT.location}`
