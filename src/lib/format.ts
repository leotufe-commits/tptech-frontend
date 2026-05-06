// src/lib/format.ts

function toFiniteNumber(n: any): number | null {
  if (n === null || n === undefined) return null;

  if (typeof n === "number") {
    return Number.isFinite(n) ? n : null;
  }

  if (typeof n === "string") {
    const s = n.trim();
    if (!s) return null;

    const compact = s.replace(/\s/g, "");

    const hasComma = compact.includes(",");
    const hasDot = compact.includes(".");

    let normalized = compact;

    if (hasComma && hasDot) {
      // usar el último separador como decimal
      const lastComma = compact.lastIndexOf(",");
      const lastDot = compact.lastIndexOf(".");

      if (lastComma > lastDot) {
        // 15.000,25 -> 15000.25
        normalized = compact.replace(/\./g, "").replace(",", ".");
      } else {
        // 15,000.25 -> 15000.25
        normalized = compact.replace(/,/g, "");
      }
    } else if (hasComma) {
      // 15000,25 -> 15000.25
      normalized = compact.replace(",", ".");
    } else {
      // 15000.25 o 253.333435 => dejar como está
      normalized = compact;
    }

    const v = Number(normalized);
    return Number.isFinite(v) ? v : null;
  }

  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export function fmtNumber2(n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";
  return v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** ✅ Alias explícito para "1,00" (2 decimales fijos) */
export function fmtFixed2(n: any): string {
  return fmtNumber2(n);
}

/**
 * Convierte un factor multiplicador a porcentaje de ajuste legible.
 *   1.10  →  "+10%"
 *   1.00  →    "0%"
 *   0.95  →   "-5%"
 * Mantiene decimales solo si son necesarios (1.105 → "+10,5%").
 * El factor original no se modifica; solo es presentación.
 */
export function fmtFactor(factor: number): string {
  const pct = Math.round((factor - 1) * 10000) / 100;
  const sign = pct > 0 ? "+" : "";
  const str = pct % 1 === 0 ? String(pct) : fmtNumber2(pct);
  return `${sign}${str}%`;
}

export function fmtMoney(v: string | number | null | undefined, sym = "$"): string {
  if (v == null || v === "") return "\u2014";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "\u2014";
  return sym + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoney2(symbol: string, n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";
  const s = String(symbol || "").trim();
  const num = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return s ? `${s} ${num}` : num;
}

// ✅ Tipo de cambio inteligente:
// - si >= 1 → 0,00
// - si < 1 → mostrar decimales reales (sin rellenar), hasta 10 decimales
export function fmtRateSmart(n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";

  if (v >= 1) {
    return v.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return v.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  });
}

// ✅ Dinero inteligente (para precios de variantes, quotes, etc.)
// - si >= 1 → 0,00
// - si < 1 → decimales reales (sin rellenar), hasta 10 decimales
export function fmtMoneySmart(symbol: string, n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";
  const s = String(symbol || "").trim();

  const num =
    v >= 1
      ? v.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : v.toLocaleString("es-AR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 10,
        });

  return s ? `${s} ${num}` : num;
}

// ✅ Número "smart" genérico (sin símbolo)
// - >= 1 → 2 decimales
// - < 1 → hasta 10 decimales (sin rellenar)
export function fmtNumberSmart(n: any): string {
  const v = toFiniteNumber(n);
  if (v === null) return "—";

  return v >= 1
    ? v.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : v.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 10,
      });
}

// ✅ Pureza / Ley: SIEMPRE 0,000 (3 decimales fijos)
export function fmtPurity3(purity: any): string {
  const v = toFiniteNumber(purity);
  if (v === null) return "—";

  const p = 10 ** 3;
  const r = Math.round((v + Number.EPSILON) * p) / p;

  return r.toFixed(3).replace(".", ",");
}

// ✅ Pureza / Ley: SIEMPRE 0,0000 (4 decimales fijos) — útil para 0.7500, 0.5850
export function fmtPurity2(purity: any): string {
  const v = toFiniteNumber(purity);
  if (v === null) return "—";

  const p = 10 ** 4;
  const r = Math.round((v + Number.EPSILON) * p) / p;

  return r.toFixed(4).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Formato de campos — teléfono y documento
// ---------------------------------------------------------------------------

/** Agrupa dígitos de izquierda a derecha en bloques de `size` separados por `sep`. */
function groupDigitsLeft(str: string, sep: string, size = 3): string {
  const parts: string[] = [];
  for (let i = 0; i < str.length; i += size) parts.push(str.slice(i, i + size));
  return parts.join(sep);
}

// ---------------------------------------------------------------------------
// Patrón personalizado — utilidades compartidas
// ---------------------------------------------------------------------------

/**
 * Cuenta cuántos `#` contiene el patrón (= cantidad de dígitos requeridos).
 */
export function countPatternDigits(pattern: string): number {
  return (pattern.match(/#/g) || []).length;
}

/**
 * Aplica un patrón simple a un valor.
 * `#` = un dígito; cualquier otro carácter es literal.
 * Solo aplica si la cantidad de dígitos del valor coincide EXACTAMENTE con
 * la cantidad de `#` del patrón — nunca produce formatos parciales.
 * Devuelve los dígitos sin formato si no hay coincidencia.
 */
export function applyPattern(value: string, pattern: string): string {
  if (!pattern) return value;
  const digits = value.replace(/\D/g, "");
  const required = countPatternDigits(pattern);
  if (!required || digits.length !== required) return digits || value;
  let result = "";
  let i = 0;
  for (const char of pattern) result += char === "#" ? digits[i++] : char;
  return result;
}

/**
 * Formatea un número de documento según el formato configurado en la joyería.
 * Siempre trabaja sobre los dígitos puros del valor almacenado.
 * Solo aplica separadores cuando la longitud del valor coincide exactamente con
 * la longitud requerida por el formato — nunca produce formatos parciales.
 *
 * Formatos soportados:
 *   "raw"         — Tal cual está almacenado
 *   "digits_only" — Solo dígitos (elimina caracteres no numéricos)
 *   — Argentina —
 *   "cuit_cuil"   — XX-XXXXXXXX-X  (11 dígitos)
 *   "dni"         — X.XXX.XXX / XX.XXX.XXX  (7-8 dígitos)
 *   — USA —
 *   "ssn"         — XXX-XX-XXXX  (9 dígitos)
 *   — Brasil —
 *   "cpf"         — XXX.XXX.XXX-XX  (11 dígitos)
 *   "cnpj"        — XX.XXX.XXX/XXXX-XX  (14 dígitos)
 *   — Chile —
 *   "rut"         — XX.XXX.XXX-D  (8-9 dígitos; acepta check digit K)
 *   — España —
 *   "es_dni"      — 12345678Z  (8 dígitos + letra; alphanumeric)
 *   "es_nie"      — X1234567L  (X/Y/Z + 7 dígitos + letra; alphanumeric)
 *   — Internacional genérico —
 *   "intl_spaces" — 123 456 789  (grupos de 3, cualquier longitud)
 *   "intl_dashes" — 123-456-789  (grupos de 3, cualquier longitud)
 */
export function formatDocument(value: string, format: string): string {
  if (!value || format === "raw") return value;
  const digits = value.replace(/\D/g, "");
  if (format === "digits_only") return digits || value;

  // --- Argentina ---
  if (format === "ar_doc") {
    if (digits.length === 11) return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
    return digits; // 8 dígitos (DNI) u otra longitud: dígitos limpios, sin separadores
  }
  if (format === "cuit_cuil" && digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  if (format === "dni") {
    if (digits.length === 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length === 7) return `${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4)}`;
  }

  // --- USA ---
  if (format === "ssn" && digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  // --- Brasil ---
  if (format === "cpf" && digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (format === "cnpj" && digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  // --- Chile (RUT) —— el check digit puede ser "K", revisar valor original ---
  if (format === "rut") {
    const trimmed = value.trim().toUpperCase().replace(/[.\-\s]/g, "");
    const withK = trimmed.match(/^(\d{7,8})K$/);
    if (withK) {
      const n = withK[1];
      if (n.length === 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}-K`;
      return `${n.slice(0, 1)}.${n.slice(1, 4)}.${n.slice(4)}-K`;
    }
    if (digits.length === 9) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}-${digits.slice(8)}`;
    if (digits.length === 8) return `${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // --- España (alphanumeric — verificar valor original, no solo dígitos) ---
  if (format === "es_dni") {
    const cleaned = value.trim().toUpperCase().replace(/[-\s]/g, "");
    if (/^\d{8}[A-Z]$/.test(cleaned)) return cleaned;
  }
  if (format === "es_nie") {
    const cleaned = value.trim().toUpperCase().replace(/[-\s]/g, "");
    if (/^[XYZ]\d{7}[A-Z]$/.test(cleaned)) return cleaned;
  }

  // --- Internacional genérico ---
  if (format === "doc_dots"    && digits) return groupDigitsLeft(digits, ".");
  if (format === "intl_spaces" && digits) return groupDigitsLeft(digits, " ");
  if (format === "intl_dashes" && digits) return groupDigitsLeft(digits, "-");

  // --- Patrón personalizado (custom:PATRON) ---
  if (format.startsWith("custom:")) {
    const pattern = format.slice(7);
    const required = countPatternDigits(pattern);
    if (required && digits.length === required) return applyPattern(value, pattern);
    return value;
  }

  return value; // fallback: longitud no reconocida
}

/**
 * Formatea prefijo + número de teléfono según el formato configurado.
 * Solo aplica separadores si la longitud del número coincide con la esperada — nunca
 * produce formatos parciales. Devuelve `raw` como fallback.
 *
 * Formatos soportados:
 *   — Argentina —
 *   "raw"                — Tal cual: "011 1123456789"
 *   "national_ar"        — (011) 1234-5678  (10 u 11 dígitos, o 8 sin área)
 *   "national_ar_plain"  — 011 1234-5678
 *   "local_ar"           — 11 1234-5678
 *   "local_ar_spaces"    — 11 1234 5678
 *   "intl_ar"            — +54 11 1234-5678
 *   "intl_ar_mobile"     — +54 9 11 1234-5678
 *   — USA —
 *   "us_national"        — (555) 123-4567  (10 dígitos)
 *   "us_plain"           — 555-123-4567    (10 dígitos)
 *   "us_intl"            — +1 555 123-4567 (10 dígitos)
 *   — España —
 *   "es_national"        — 612 34 56 78    (9 dígitos)
 *   "es_intl"            — +34 612 34 56 78 (9 dígitos)
 *   — Brasil —
 *   "br_national"        — (11) 91234-5678 / (11) 1234-5678  (11/10 dígitos)
 *   "br_plain"           — 11 91234-5678 / 11 1234-5678
 *   "br_intl"            — +55 11 91234-5678 / +55 11 1234-5678
 *   — Chile —
 *   "cl_national"        — 9 1234 5678  (9 dígitos)
 *   "cl_intl"            — +56 9 1234 5678 (9 dígitos)
 *   — Internacional genérico —
 *   "phone_3_3_4"        — XXX XXX XXXX  (10 dígitos)
 *   "phone_3_3_4_dash"   — XXX-XXX-XXXX  (10 dígitos)
 *   "phone_digits"       — solo dígitos del número
 */
export function formatPhone(prefix: string, number: string, format: string): string {
  if (!number && !prefix) return "";
  const raw = [prefix, number].filter(Boolean).join(" ").trim();
  if (!format || format === "raw") return raw;

  const digits = (number || "").replace(/\D/g, "");

  if (format === "phone_digits") return digits || raw;

  // --- Patrón personalizado (custom:PATRON) ---
  if (format.startsWith("custom:")) {
    const pattern = format.slice(7);
    const required = countPatternDigits(pattern);
    if (required && digits.length === required) return applyPattern(number || "", pattern);
    return raw;
  }

  // --- Argentina ---
  if (format === "national_ar") {
    if (digits.length === 10) return `(0${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === "0") return `(${digits.slice(0, 3)}) ${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return raw;
  }
  if (format === "national_ar_plain") {
    if (digits.length === 10) return `0${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === "0") return `${digits.slice(0, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return raw;
  }
  if (format === "local_ar") {
    if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return raw;
  }
  if (format === "local_ar_spaces") {
    if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
    if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return raw;
  }
  if (format === "intl_ar") {
    if (digits.length === 10) return `+54 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 8) return `+54 ${digits.slice(0, 4)}-${digits.slice(4)}`;
    return raw;
  }
  if (format === "intl_ar_mobile") {
    if (digits.length === 10) return `+54 9 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 8) return `+54 9 ${digits.slice(0, 4)}-${digits.slice(4)}`;
    return raw;
  }

  // --- USA (NANP — 10 dígitos) ---
  if (format === "us_national") {
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }
  if (format === "us_plain") {
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }
  if (format === "us_intl") {
    if (digits.length === 10) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }

  // --- España (9 dígitos) ---
  if (format === "es_national") {
    if (digits.length === 9) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
    return raw;
  }
  if (format === "es_intl") {
    if (digits.length === 9) return `+34 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
    return raw;
  }

  // --- Brasil (11 dígitos móvil / 10 dígitos fijo) ---
  if (format === "br_national") {
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw;
  }
  if (format === "br_plain") {
    if (digits.length === 11) return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw;
  }
  if (format === "br_intl") {
    if (digits.length === 11) return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return raw;
  }

  // --- Chile (9 dígitos) ---
  if (format === "cl_national") {
    if (digits.length === 9) return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
    return raw;
  }
  if (format === "cl_intl") {
    if (digits.length === 9) return `+56 ${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
    return raw;
  }

  // --- Internacional genérico (10 dígitos) ---
  if (format === "phone_3_3_4") {
    if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return raw;
  }
  if (format === "phone_3_3_4_dash") {
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }

  return raw;
}

/**
 * Devuelve un texto de ejemplo (placeholder) según el formato configurado.
 * Útil para mostrar en inputs y en la página de configuración.
 */
export const PHONE_FORMAT_PLACEHOLDER: Record<string, string> = {
  // Argentina
  raw:               "011 1123456789",
  national_ar:       "(011) 1234-5678",
  national_ar_plain: "011 1234-5678",
  local_ar:          "11 1234-5678",
  local_ar_spaces:   "11 1234 5678",
  intl_ar:           "+54 11 1234-5678",
  intl_ar_mobile:    "+54 9 11 1234-5678",
  // USA
  us_national:       "(555) 123-4567",
  us_plain:          "555-123-4567",
  us_intl:           "+1 555 123-4567",
  // España
  es_national:       "612 34 56 78",
  es_intl:           "+34 612 34 56 78",
  // Brasil
  br_national:       "(11) 91234-5678",
  br_plain:          "11 91234-5678",
  br_intl:           "+55 11 91234-5678",
  // Chile
  cl_national:       "9 1234 5678",
  cl_intl:           "+56 9 1234 5678",
  // Internacional genérico
  phone_3_3_4:       "555 123 4567",
  phone_3_3_4_dash:  "555-123-4567",
  phone_digits:      "5551234567",
  // Personalizado
  custom:            "## ####-####",
};

export const DOCUMENT_FORMAT_PLACEHOLDER: Record<string, string> = {
  raw:          "20123456789",
  ar_doc:       "20-12345678-9 / 29039672",
  doc_dots:     "123.456.789",
  cuit_cuil:    "20-12345678-9",
  dni:          "12.345.678",
  digits_only:  "20123456789",
  ssn:          "123-45-6789",
  cpf:          "123.456.789-00",
  cnpj:         "12.345.678/0001-99",
  rut:          "12.345.678-9",
  es_dni:       "12345678Z",
  es_nie:       "X1234567L",
  intl_spaces:  "123 456 789",
  intl_dashes:  "123-456-789",
  // Personalizado
  custom:       "##-########-#",
};

// ---------------------------------------------------------------------------
// Formateo progresivo para inputs (autoformateo mientras se escribe)
// Aplica separadores digit-a-digit sin romper la experiencia de edición.
// Usados por usePhoneInput / useDocInput — NO usar en views/tablas.
// ---------------------------------------------------------------------------

/**
 * Formatea el número de teléfono local progresivamente mientras se escribe.
 * Aplica la máscara del país seleccionado para dar feedback visual inmediato.
 * El valor que se guarda siempre son los dígitos limpios — este formato es solo display.
 */
export function formatPhoneInputProgressive(digits: string, format: string): string {
  if (!digits) return "";
  if (!format || format === "raw" || format === "phone_digits") return digits;

  // Argentina — ## ####-#### (10 dígitos)
  if (!format || format.startsWith("national_ar") || format.startsWith("local_ar") ||
      format.startsWith("intl_ar")) {
    if (digits.length > 10) return digits;
    let r = digits.slice(0, 2);
    if (digits.length > 2) r += " " + digits.slice(2, 6);
    if (digits.length > 6) r += "-" + digits.slice(6, 10);
    return r;
  }

  // USA — XXX-XXX-XXXX (10 dígitos)
  if (format.startsWith("us_")) {
    if (digits.length > 10) return digits;
    let r = digits.slice(0, 3);
    if (digits.length > 3) r += "-" + digits.slice(3, 6);
    if (digits.length > 6) r += "-" + digits.slice(6, 10);
    return r;
  }

  // España — XXX XX XX XX (9 dígitos)
  if (format.startsWith("es_")) {
    if (digits.length > 9) return digits;
    let r = digits.slice(0, 3);
    if (digits.length > 3) r += " " + digits.slice(3, 5);
    if (digits.length > 5) r += " " + digits.slice(5, 7);
    if (digits.length > 7) r += " " + digits.slice(7, 9);
    return r;
  }

  // Brasil — XX XXXXX-XXXX (11 dígitos / móvil)
  if (format.startsWith("br_")) {
    if (digits.length > 11) return digits;
    let r = digits.slice(0, 2);
    if (digits.length > 2) r += " " + digits.slice(2, 7);
    if (digits.length > 7) r += "-" + digits.slice(7, 11);
    return r;
  }

  // Chile — X XXXX XXXX (9 dígitos)
  if (format.startsWith("cl_")) {
    if (digits.length > 9) return digits;
    let r = digits.slice(0, 1);
    if (digits.length > 1) r += " " + digits.slice(1, 5);
    if (digits.length > 5) r += " " + digits.slice(5, 9);
    return r;
  }

  // Internacional genérico — XXX XXX XXXX / XXX-XXX-XXXX (10 dígitos)
  if (format === "phone_3_3_4") {
    if (digits.length > 10) return digits;
    let r = digits.slice(0, 3);
    if (digits.length > 3) r += " " + digits.slice(3, 6);
    if (digits.length > 6) r += " " + digits.slice(6, 10);
    return r;
  }
  if (format === "phone_3_3_4_dash") {
    if (digits.length > 10) return digits;
    let r = digits.slice(0, 3);
    if (digits.length > 3) r += "-" + digits.slice(3, 6);
    if (digits.length > 6) r += "-" + digits.slice(6, 10);
    return r;
  }

  // Patrón personalizado (custom:PATRON)
  if (format.startsWith("custom:")) {
    const pattern = format.slice(7);
    const required = countPatternDigits(pattern);
    if (required && digits.length === required) return applyPattern(digits, pattern);
    return digits;
  }

  // Fallback: AR pattern
  if (digits.length > 10) return digits;
  let r = digits.slice(0, 2);
  if (digits.length > 2) r += " " + digits.slice(2, 6);
  if (digits.length > 6) r += "-" + digits.slice(6, 10);
  return r;
}

/**
 * Formatea el número de documento progresivamente mientras el usuario escribe.
 *
 * Regla general: solo aplica separadores cuando la longitud es exactamente la válida
 * para ese formato — nunca produce formatos parciales con separadores incompletos.
 *
 * Excepciones: "dni" e "intl_*" sí aplican máscara progresiva (son tolerantes a longitud).
 * "es_dni" / "es_nie": el hook solo maneja dígitos; la letra final se pierde.
 */
export function formatDocumentInputProgressive(digits: string, format: string): string {
  if (!digits) return "";
  if (!format || format === "raw" || format === "digits_only") return digits;

  if (format === "ar_doc") {
    if (digits.length === 11) return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
    return digits; // 8 dígitos (DNI) u otra longitud: sin separadores
  }

  if (format === "cuit_cuil") {
    if (digits.length !== 11) return digits;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }

  if (format === "dni") {
    if (digits.length > 8) return digits;
    const d = digits.slice(0, 8);
    if (d.length <= 2) return d;
    let r = d.slice(0, 2);
    if (d.length > 2) r += "." + d.slice(2, 5);
    if (d.length > 5) r += "." + d.slice(5, 8);
    return r;
  }

  if (format === "ssn") {
    if (digits.length !== 9) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  if (format === "cpf") {
    if (digits.length !== 11) return digits;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (format === "cnpj") {
    if (digits.length !== 14) return digits;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  if (format === "rut") {
    if (digits.length === 9) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}-${digits.slice(8)}`;
    if (digits.length === 8) return `${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4, 7)}-${digits.slice(7)}`;
    return digits;
  }

  // es_dni, es_nie: el hook solo acepta dígitos; la letra de verificación no se puede autocompletar
  if (format === "es_dni" || format === "es_nie") return digits;

  if (format === "doc_dots")    return groupDigitsLeft(digits, ".");
  if (format === "intl_spaces") return groupDigitsLeft(digits, " ");
  if (format === "intl_dashes") return groupDigitsLeft(digits, "-");

  // Patrón personalizado (custom:PATRON)
  if (format.startsWith("custom:")) {
    const pattern = format.slice(7);
    const required = countPatternDigits(pattern);
    if (required && digits.length === required) return applyPattern(digits, pattern);
    return digits;
  }

  return digits;
}

// Si necesitás ordenar por pureza usando el mismo redondeo:
export function purityKey3(purity: any): number {
  const v = toFiniteNumber(purity);
  if (v === null) return -Infinity;
  const p = 10 ** 3;
  return Math.round((v + Number.EPSILON) * p) / p;
}

// ✅ Key estable para ordenar por pureza (4 decimales)
export function purityKey2(purity: any): number {
  const v = toFiniteNumber(purity);
  if (v === null) return -Infinity;
  const p = 10 ** 4;
  return Math.round((v + Number.EPSILON) * p) / p;
}