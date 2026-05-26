// src/lib/sales/interpolateEmailTemplate.ts
// =============================================================================
// Reemplaza las variables `{{name}}` en una plantilla de email por sus
// valores reales. Variables soportadas (acordadas con producto):
//   {{cliente}}  — nombre del cliente (clientSnapshot.name o draft.client)
//   {{numero}}   — Receipt.code o Sale.code, segun corresponda
//   {{joyeria}}  — printCompany.legalName || printCompany.name
//   {{estado}}   — "BORRADOR" / "FACTURA ANULADA" / "Factura" (state-aware)
//   {{fecha}}    — fecha del comprobante formateada por el locale del tenant
//
// Reglas:
//   · Si una variable no tiene valor (string vacio/undefined) → se reemplaza
//     por "" (no rompe el template, deja un hueco).
//   · El matching es case-sensitive en el nombre de la variable: `{{cliente}}`
//     coincide pero `{{Cliente}}` no. Mantener simple para v1.
//   · NO escapa HTML — la salida es texto plano que se mostrara en un
//     <textarea> y se enviara como body. El backend ya envuelve el body en
//     <pre> con `white-space: pre-wrap` y escape HTML (sales.service.ts).
//   · Idempotente: aplicar dos veces produce el mismo resultado (la segunda
//     pasada no encuentra mas `{{...}}`).
// =============================================================================

export interface EmailTemplateVars {
  cliente?: string | null;
  numero?:  string | null;
  joyeria?: string | null;
  estado?:  string | null;
  fecha?:   string | null;
}

export function interpolateEmailTemplate(
  template: string | null | undefined,
  vars:     EmailTemplateVars,
): string {
  if (!template) return "";
  return template
    .replaceAll("{{cliente}}", String(vars.cliente ?? ""))
    .replaceAll("{{numero}}",  String(vars.numero  ?? ""))
    .replaceAll("{{joyeria}}", String(vars.joyeria ?? ""))
    .replaceAll("{{estado}}",  String(vars.estado  ?? ""))
    .replaceAll("{{fecha}}",   String(vars.fecha   ?? ""));
}

/** Lista canonica de variables disponibles. Util para mostrar un hint en
 *  el modal y para validar que el usuario no haya escrito una variable
 *  inexistente (si en algun momento agregamos warning). */
export const SUPPORTED_EMAIL_VARS = [
  "{{cliente}}",
  "{{numero}}",
  "{{joyeria}}",
  "{{estado}}",
  "{{fecha}}",
] as const;
