/** Canales de comunicación para los que se puede generar un User Journey Map distinto. */

/**
 * **Todos los canales** (`journey_base`): recorrido end-to-end sin ceñirse a un solo medio (HMW + persona + POV).
 * Los demás canales del catálogo detallan la interacción en cada medio concreto.
 */
export const JOURNEY_BASE_CANAL_ID = 'journey_base' as const

export const USER_JOURNEY_CANALES = [
  {
    id: 'web',
    label: 'Página web',
    descripcionCorta: 'el sitio web',
    focoExperiencia:
      'navegación por páginas, formularios, CTAs, testimonios en pantalla y abandono o cierre de la visita en el navegador',
    cierreExperiencia: 'sale de la web (cierra pestaña, abandona o completa la visita)',
  },
  {
    id: 'email',
    label: 'Correo electrónico',
    descripcionCorta: 'el correo electrónico',
    focoExperiencia:
      'buzón, asunto y cuerpo del mensaje, enlaces desde el email, respuestas de MOA, cadencia y sensación de cercanía o frío',
    cierreExperiencia: 'deja de interactuar por este hilo (archiva, no responde más o pasa a otro canal)',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    descripcionCorta: 'WhatsApp',
    focoExperiencia:
      'chat móvil, tiempos de respuesta, tono del mensaje, envío de fotos o enlaces, confirmaciones y cierre de la conversación',
    cierreExperiencia: 'cierra o archiva el chat o deja de esperar respuesta',
  },
  {
    id: 'redes_sociales',
    label: 'Redes sociales',
    descripcionCorta: 'redes sociales (p. ej. Instagram)',
    focoExperiencia:
      'publicaciones, stories, DMs, comentarios, descubrimiento del perfil y paso a reserva o contacto por otro canal',
    cierreExperiencia: 'sale del perfil o del DM y deja la interacción en pausa o cerrada',
  },
  {
    id: 'presencial',
    label: 'Centro / presencial',
    descripcionCorta: 'la experiencia en el centro',
    focoExperiencia:
      'llegada, acogida, conversación con staff o Patri, material físico, incertidumbre antes/después de la visita',
    cierreExperiencia: 'termina la visita o el intercambio en recepción/sala',
  },
  {
    id: 'telefono',
    label: 'Teléfono',
    descripcionCorta: 'la llamada telefónica',
    focoExperiencia:
      'marcar, espera, tono de voz, dudas en vivo, siguiente paso acordado y sensación de confianza o presión',
    cierreExperiencia: 'cuelga o acuerda un siguiente paso y finaliza la llamada',
  },
] as const

export type UserJourneyCanalId = (typeof USER_JOURNEY_CANALES)[number]['id']

export const DEFAULT_USER_JOURNEY_CANAL_ID: UserJourneyCanalId = 'web'

export function isKnownUserJourneyCanalId(id: string): id is UserJourneyCanalId {
  return USER_JOURNEY_CANALES.some((c) => c.id === id)
}

export function getUserJourneyCanalMeta(id: string) {
  return USER_JOURNEY_CANALES.find((c) => c.id === id) ?? USER_JOURNEY_CANALES[0]
}

/** Catálogo editable (presets + canales personalizados por segmento). */
export interface JourneyCanalDef {
  id: string
  label: string
  esPreset?: boolean
}

const JOURNEY_BASE_DEF: JourneyCanalDef = {
  id: JOURNEY_BASE_CANAL_ID,
  label: 'Todos los canales',
  esPreset: true,
}

export function defaultJourneyCanalCatalogo(): JourneyCanalDef[] {
  return [JOURNEY_BASE_DEF, ...USER_JOURNEY_CANALES.map((c) => ({ id: c.id, label: c.label, esPreset: true }))]
}

/** Alinea etiquetas de presets con el código (p. ej. tras renombrar un canal) sin tocar canales personalizados. */
export function syncPresetCanalLabelsInCatalog(catalogo: JourneyCanalDef[]): JourneyCanalDef[] {
  return catalogo.map((c) => {
    if (c.id === JOURNEY_BASE_CANAL_ID) {
      return { ...c, label: JOURNEY_BASE_DEF.label, esPreset: true }
    }
    const preset = USER_JOURNEY_CANALES.find((p) => p.id === c.id)
    if (preset) return { ...c, label: preset.label, esPreset: true }
    return c
  })
}

/** Asegura el canal base en catálogos guardados antes de existir `journey_base`. */
export function ensureBaseChannelInCatalog(catalogo: JourneyCanalDef[]): JourneyCanalDef[] {
  if (catalogoContainsId(catalogo, JOURNEY_BASE_CANAL_ID)) return catalogo
  return [JOURNEY_BASE_DEF, ...catalogo]
}

export function newCustomJourneyCanalId(): string {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/** Metadatos para prompts de IA: preset completo o canal personalizado por etiqueta. */
export type CanalPromptFields = {
  label: string
  descripcionCorta: string
  focoExperiencia: string
  cierreExperiencia: string
}

export function getCanalPromptFields(canalId: string, catalogo: JourneyCanalDef[]): CanalPromptFields {
  if (canalId === JOURNEY_BASE_CANAL_ID) {
    return {
      label: 'Todos los canales',
      descripcionCorta: 'el recorrido end-to-end de la persona',
      focoExperiencia:
        'cómo descubre su necesidad, busca información, evalúa opciones, encuentra a MOA y da el paso a contratar o continuar el servicio — usando los datos del HMW, la persona y el POV, sin forzar un único medio (web, boca a boca, salud, redes, etc. pueden aparecer a lo largo del relato)',
      cierreExperiencia:
        'cierra el arco con decisión o continuidad respecto a MOA alineada con el POV y el HMW del segmento',
    }
  }
  const preset = USER_JOURNEY_CANALES.find((c) => c.id === canalId)
  if (preset) return preset
  const def = catalogo.find((c) => c.id === canalId)
  const label = def?.label?.trim() || canalId
  return {
    label,
    descripcionCorta: `el canal «${label}»`,
    focoExperiencia: `interacción de la persona con MOA a través de ${label}`,
    cierreExperiencia: `cierra o abandona la interacción en ${label}`,
  }
}

export function catalogoContainsId(catalogo: JourneyCanalDef[], id: string): boolean {
  return catalogo.some((c) => c.id === id)
}

export function normalizeCanalInCatalog(
  canalId: string,
  catalogo: JourneyCanalDef[],
  fallbackId: string = DEFAULT_USER_JOURNEY_CANAL_ID
): string {
  if (catalogoContainsId(catalogo, canalId)) return canalId
  if (catalogoContainsId(catalogo, fallbackId)) return fallbackId
  return catalogo[0]?.id ?? DEFAULT_USER_JOURNEY_CANAL_ID
}

/** Solo presets (compat v2 / URLs antiguas). */
export function normalizeCanalActivoId(id: string): string {
  if (isKnownUserJourneyCanalId(id)) return id
  return DEFAULT_USER_JOURNEY_CANAL_ID
}
