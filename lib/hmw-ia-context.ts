import { CLIENT_AI_SERVICE_CONTEXT } from '@/lib/client-ai-service-context'
import { CLIENT } from '@/lib/client-config'
import { fetchSavedPovFromSheets, povPairToPlainTextForHmw } from '@/lib/fetch-saved-pov'
import { fetchSavedUserPersonas, personaRecordToPlainText } from '@/lib/fetch-saved-user-personas'
import { empathyMapToPlainText, fetchSavedEmpathyMap } from '@/lib/fetch-saved-empathy-map'

export type HmwIaContextSections = {
  textoPov: string
  personaActual: string
  personaPotencial: string
  mapaActual: string
  mapaPotencial: string
}

/** Carga POV, personas y mapas de empatía para prompts de IA en HMW. */
export async function loadHmwIaContextOrFail(): Promise<
  { ok: true; ctx: HmwIaContextSections } | { ok: false; message: string }
> {
  const pov = await fetchSavedPovFromSheets()
  if (!pov.ok) {
    return {
      ok: false,
      message:
        'No hay POV guardados. Ve a /pov y guarda las dos declaraciones antes de usar funciones con IA en HMW.',
    }
  }

  const [empClientes, empPotenciales, personas] = await Promise.all([
    fetchSavedEmpathyMap('clientes'),
    fetchSavedEmpathyMap('potenciales'),
    fetchSavedUserPersonas(),
  ])

  const mapaActual = empClientes.ok
    ? `### Mapa de empatía — clientes actuales\n${empathyMapToPlainText(empClientes.data)}`
    : '### Mapa de empatía — clientes actuales\n(sin datos guardados en Sheets para este segmento.)'

  const mapaPotencial = empPotenciales.ok
    ? `### Mapa de empatía — clientes potenciales\n${empathyMapToPlainText(empPotenciales.data)}`
    : '### Mapa de empatía — clientes potenciales\n(sin datos guardados en Sheets para este segmento.)'

  const personaActual = personas.ok
    ? personaRecordToPlainText('User persona — cliente actual', personas.data.clienteActual)
    : '(User persona de cliente actual no disponible en Sheets.)'

  const personaPotencial = personas.ok
    ? personaRecordToPlainText('User persona — cliente potencial', personas.data.clientePotencial)
    : '(User persona de cliente potencial no disponible en Sheets.)'

  return {
    ok: true,
    ctx: {
      textoPov: povPairToPlainTextForHmw(pov.data),
      personaActual,
      personaPotencial,
      mapaActual,
      mapaPotencial,
    },
  }
}

/** Regla anti-alucinación: no hay otro origen de “verdad” aparte del bloque markdown. */
const HMW_IA_SOLO_CONTEXTO = `

### Uso del contexto (obligatorio)
Lo anterior es la **única** información fáctica que tienes sobre ${CLIENT.name}, ${CLIENT.ownerFirstName} y las personas. **No inventes** software, web, app, CRM, «plataforma existente», integraciones ni canales que **no aparezcan de forma explícita** en POV, user personas o mapas de empatía. Si no se nombra un producto digital concreto, **no asumas** que ya existe: las ideas y motivos deben basarse solo en lo escrito arriba o en supuestos neutros (p. ej. “desde cero”, “a valorar con ${CLIENT.ownerFirstName}”), sin afirmar que hay un sistema previo.${CLIENT_AI_SERVICE_CONTEXT}`

export function hmwIaContextToMarkdown(ctx: HmwIaContextSections): string {
  return `=== POV (obligatorio, alineación principal) ===
${ctx.textoPov}

=== User personas (si existen) ===
${ctx.personaActual}

${ctx.personaPotencial}

${ctx.mapaActual}

${ctx.mapaPotencial}${HMW_IA_SOLO_CONTEXTO}`
}
