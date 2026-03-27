// src/pages/configuracion-sistema/clientes/importColumns.ts
// Definición centralizada de columnas para importación masiva de entidades comerciales.
// - `label`  → encabezado visible en la plantilla (CSV y XLSX)
// - `field`  → nombre interno que espera el backend

export type ImportColumnDef = {
  label:   string;
  field:   string;
  /** Si true, la columna se oculta en la plantilla Excel */
  hidden?: boolean;
};

/** Campos obligatorios según el rol */
export const REQUIRED_FIELDS: Record<"client" | "supplier", string[]> = {
  client:   ["firstName", "lastName"],
  supplier: ["tradeName"],
};

export const IMPORT_COLUMNS: ImportColumnDef[] = [
  // ── Identidad ─────────────────────────────────────────────────────────────
  { label: "Tipo entidad",            field: "entityType"   }, // PERSONA | EMPRESA
  { label: "Razón social",            field: "companyName"  }, // obligatorio si EMPRESA
  { label: "Nombre de fantasía",      field: "tradeName"    },
  { label: "Nombre",                  field: "firstName"    }, // obligatorio si PERSONA (cliente)
  { label: "Apellido",                field: "lastName"     }, // obligatorio si PERSONA (cliente)
  // ── Contacto primario ────────────────────────────────────────────────────
  { label: "Email",                   field: "email"        },
  { label: "Teléfono",                field: "phone"        },
  // ── Fiscal ────────────────────────────────────────────────────────────────
  { label: "Tipo documento",          field: "documentType"   },
  { label: "Número documento",        field: "documentNumber" },
  { label: "Condición IVA",           field: "ivaCondition"   },
  // ── Comercial ─────────────────────────────────────────────────────────────
  { label: "Término de pago",         field: "paymentTerm"    },
  { label: "Moneda habitual",         field: "currencyCode"   },
  { label: "Lista de precios",        field: "priceListName"  },
  // ── Estado ────────────────────────────────────────────────────────────────
  { label: "Activo",                  field: "isActive"       }, // SI | NO
  { label: "Observaciones",           field: "notes"          },
  // ── Dirección ─────────────────────────────────────────────────────────────
  { label: "Etiqueta dirección",      field: "addressLabel"   },
  { label: "Calle",                   field: "street"         },
  { label: "Número",                  field: "streetNumber"   },
  { label: "Piso",                    field: "floor"          },
  { label: "Dpto.",                   field: "apartment"      },
  { label: "Ciudad",                  field: "city"           },
  { label: "Provincia",               field: "province"       },
  { label: "País",                    field: "country"        },
  { label: "Código postal",           field: "postalCode"     },
  // ── Contacto principal ────────────────────────────────────────────────────
  { label: "Nombre contacto",         field: "contactFirstName" },
  { label: "Apellido contacto",       field: "contactLastName"  },
  { label: "Cargo contacto",          field: "contactPosition"  },
  { label: "Email contacto",          field: "contactEmail"     },
  { label: "Teléfono contacto",       field: "contactPhone"     },
  { label: "Notas contacto",          field: "contactNotes"     },
];

// ─── Encabezados ──────────────────────────────────────────────────────────────

/** Encabezados visibles para CSV (sin asterisco) */
export const IMPORT_LABELS = IMPORT_COLUMNS.map((c) => c.label);

/** Encabezados para Excel con asterisco en los campos obligatorios según el rol */
export function getImportLabelsXLSX(role: "client" | "supplier"): string[] {
  const required = new Set(REQUIRED_FIELDS[role]);
  return IMPORT_COLUMNS.map((c) => required.has(c.field) ? `${c.label} *` : c.label);
}

/** @deprecated usar getImportLabelsXLSX(role) */
export const IMPORT_LABELS_XLSX = getImportLabelsXLSX("supplier");

// ─── Mapeo label → field ──────────────────────────────────────────────────────

/** Mapa label exacto → field */
export const LABEL_TO_FIELD: Record<string, string> = Object.fromEntries(
  IMPORT_COLUMNS.map(({ label, field }) => [label, field])
);

/** Mapa label en minúsculas → field (para matching case-insensitive) */
const LABEL_TO_FIELD_LOWER: Record<string, string> = Object.fromEntries(
  IMPORT_COLUMNS.map(({ label, field }) => [label.toLowerCase(), field])
);

/**
 * Aliases: nombres alternativos que puede traer un archivo real.
 * Clave: nombre en minúsculas (sin asterisco). Valor: field interno.
 */
const HEADER_ALIASES: Record<string, string> = {
  // Variantes con "principal"
  "email principal":                    "email",
  "teléfono principal":                 "phone",
  "telefono principal":                 "phone",
  "nombre contacto principal":          "contactFirstName",
  "apellido contacto principal":        "contactLastName",
  "cargo contacto principal":           "contactPosition",
  "email contacto principal":           "contactEmail",
  "teléfono contacto principal":        "contactPhone",
  "telefono contacto principal":        "contactPhone",
  "notas contacto principal":           "contactNotes",
  "observaciones contacto principal":   "contactNotes",
  // Variantes de Dpto.
  "depto":                              "apartment",
  "departamento":                       "apartment",
  // Variantes sin tilde
  "razon social":                       "companyName",
  "nombre de fantasia":                 "tradeName",
  "condicion iva":                      "ivaCondition",
  "termino de pago":                    "paymentTerm",
  "moneda habitual":                    "currencyCode",
  "lista de precios":                   "priceListName",
  "etiqueta direccion":                 "addressLabel",
  "numero":                             "streetNumber",
  "codigo postal":                      "postalCode",
  "tipo entidad":                       "entityType",
  "numero documento":                   "documentNumber",
  "tipo documento":                     "documentType",
};

/**
 * Transforma una fila con claves de label (o alias) a claves de field interno.
 * Orden de resolución:
 * 1. Match exacto en LABEL_TO_FIELD
 * 2. Match case-insensitive en LABEL_TO_FIELD
 * 3. Match en HEADER_ALIASES (lowercase)
 * 4. Pasa el key tal cual (puede ya ser un field interno)
 */
export function mapRowToFields(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const clean = rawKey.replace(/\s*\*$/, "").trim();
    const lower = clean.toLowerCase();
    const field =
      LABEL_TO_FIELD[clean]      ??
      LABEL_TO_FIELD_LOWER[lower] ??
      HEADER_ALIASES[lower]      ??
      clean;
    result[field] = value;
  }
  return result;
}

// ─── Filas de ejemplo ─────────────────────────────────────────────────────────

export const EXAMPLE_COMPANY_ROW: string[] = [
  "EMPRESA",
  "Distribuidora SA", "Distrib.",
  "Juan", "González",
  "contacto@distrib.com.ar", "+54 11 5678-9012",
  "CUIT", "30-98765432-1", "Responsable Inscripto",
  "30 días", "ARS", "",
  "SI", "Proveedor de materias primas",
  "Depósito central", "Av. Corrientes", "1234", "3", "B", "CABA", "Buenos Aires", "Argentina", "C1043",
  "Juan", "González", "Gerente de Ventas", "juan@distrib.com.ar", "+54 11 1234-5678", "",
];

export const EXAMPLE_PERSON_ROW: string[] = [
  "PERSONA",
  "", "",
  "Carlos", "Rodríguez",
  "carlos@gmail.com", "+54 351 4567-8901",
  "DNI", "28-345678-9", "Monotributista",
  "Contado", "", "",
  "SI", "",
  "", "Calle Falsa", "123", "", "", "Córdoba", "Córdoba", "Argentina", "5000",
  "", "", "", "", "", "",
];
