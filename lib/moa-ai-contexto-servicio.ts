import { CLIENT } from './client-config'

/**
 * Texto reutilizable para system prompts: evita el sesgo "todo es online" y
 * ancla al modelo real del cliente. Para un nuevo proyecto, actualiza las
 * variables de entorno en .env.local — no es necesario editar este archivo.
 */
export const MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO = `
## Realidad del servicio ${CLIENT.name} (prioridad sobre suposiciones típicas de la IA)
- El **grueso del negocio** son sesiones y acompañamiento **${CLIENT.serviceModel}** (espacio físico, grupo, relación directa con ${CLIENT.ownerFirstName} en ${CLIENT.location} según el material que recibes).
- El servicio **online** existe como **complemento**, pero **no** es el formato mayoritario: no redactes como si la experiencia típica fuera videollamadas, solo app o "100 % digital", salvo que encuesta, insights, POV, user persona, journey u **otra fuente explícita del prompt** lo indique.
- Si el prompt incluye la **encuesta / entrevista estructurada a ${CLIENT.ownerFirstName} (${CLIENT.ownerRole})** (respuestas por tema en la hoja principal), úsala como **fuente de verdad** sobre cómo opera ${CLIENT.name}: modelo de servicio, qué se hace en persona vs a distancia, mensajes de marca, prioridades y tipo de clientela. Alinea narrativas, canales, etapas del journey e ideas con esa encuesta y con el resto de datos del prompt; **no la contradigas** con un estereotipo de negocio digital ni omitas restricciones que la CEO declare explícitamente.`
