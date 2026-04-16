/**
 * Texto reutilizable para system prompts: evita el sesgo “todo es online” y ancla al modelo real de MOA.
 * Cuando el mismo prompt incluye la entrevista a Patricia, debe prevalecer sobre suposiciones genéricas.
 */
export const MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO = `
## Realidad del servicio MOA (prioridad sobre suposiciones típicas de la IA)
- El **grueso del negocio** son sesiones y acompañamiento **presencial** (espacio físico, grupo, relación directa con Patri en Martorell según el material que recibes).
- El **entrenamiento online** existe como **complemento**, pero **no** es el formato mayoritario: no redactes como si la experiencia típica fuera videollamadas, solo app o “fitness 100 % digital”, salvo que encuesta, insights, POV, user persona, journey u **otra fuente explícita del prompt** lo indique.
- Si el prompt incluye la **entrevista a Patricia (CEO / fundadora)**, úsala como **fuente de verdad** sobre cómo opera MOA (qué se hace en persona vs a distancia, mensajes de marca, tipo de clientela). Alinea narrativas, canales y escenas con esa entrevista y con el resto de datos del prompt; no la contradigas con un estereotipo de negocio digital.`
