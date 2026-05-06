// src/lib/import-mapping/types.ts
// Tipos compartidos para el sistema de mapeo de columnas de importación.

export type FieldDef = {
  key: string;          // Clave interna del campo (header de template para artículos, camelCase para entidades)
  label: string;        // Etiqueta legible mostrada en la UI
  required?: boolean;   // ¿Es obligatorio para continuar?
  aliases: string[];    // Aliases normalizados para auto-matching (minúsculas, sin tildes)
  description?: string; // Tooltip opcional
};

export type ColumnMapping = {
  fileHeader: string;       // Nombre original de la columna en el archivo subido
  mappedTo:   string | null; // Clave interna del campo, o null si el usuario eligió ignorar
  example:    string;        // Primer valor no vacío de esa columna (para preview en UI)
};

// Futuro: guardar/cargar plantillas de mapeo
export type MappingTemplate = {
  id?:        string;
  name:       string;
  entityType: "article" | "entity";
  mappings:   Record<string, string>; // fileHeader → fieldKey
  createdAt?: string;
};
