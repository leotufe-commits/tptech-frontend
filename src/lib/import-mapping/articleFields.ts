// src/lib/import-mapping/articleFields.ts
// Definición de campos de artículos para el sistema de mapeo de columnas.
// Las claves (key) deben coincidir exactamente con los TEMPLATE_HEADERS del backend.

import type { FieldDef } from "./types";

export const ARTICLE_FIELDS: FieldDef[] = [
  {
    key: "Nombre",
    label: "Nombre del artículo",
    required: true,
    aliases: ["nombre", "name", "producto", "articulo", "item", "descripcion corta", "title", "titulo", "denominacion"],
  },
  {
    key: "Codigo",
    label: "Código",
    aliases: ["codigo", "cod", "code", "ref", "referencia", "cod art", "cod_art", "articulo codigo", "art cod", "item code", "cod"],
  },
  {
    key: "SKU",
    label: "SKU",
    aliases: ["sku", "stock keeping unit", "sku interno", "sku propio"],
  },
  {
    key: "Barcode",
    label: "Código de barras",
    aliases: ["barcode", "codigo de barras", "ean", "ean13", "ean 13", "upc", "gtin", "cod barras", "codbarra", "barra"],
  },
  {
    key: "Tipo_Barcode",
    label: "Tipo código de barras",
    aliases: ["tipo barcode", "tipo codigo barras", "barcode type", "tipo_barcode"],
  },
  {
    key: "Categoria",
    label: "Categoría",
    aliases: ["categoria", "category", "rubro", "familia", "giro", "linea", "tipo articulo", "categor"],
  },
  {
    key: "Grupo",
    label: "Grupo comercial",
    aliases: ["grupo", "group", "grupo comercial", "commercial group", "grupo art"],
  },
  {
    key: "Proveedor",
    label: "Proveedor preferido",
    aliases: ["proveedor", "supplier", "preferred supplier", "proveedor preferido", "cod proveedor"],
  },
  {
    key: "Marca",
    label: "Marca",
    aliases: ["marca", "brand", "marca comercial"],
  },
  {
    key: "Fabricante",
    label: "Fabricante",
    aliases: ["fabricante", "manufacturer", "manufacturer name", "fabr"],
  },
  {
    key: "Descripcion",
    label: "Descripción",
    aliases: ["descripcion", "description", "detalle", "observacion", "obs", "desc", "detalle articulo"],
  },
  {
    key: "Precio_Costo",
    label: "Precio costo",
    aliases: ["precio costo", "costo", "cost", "cost price", "precio_costo", "pcosto", "p costo", "costo unitario"],
  },
  {
    key: "Precio_Venta",
    label: "Precio venta",
    aliases: ["precio venta", "precio", "price", "pvp", "venta", "sale price", "precio_venta", "pventa", "p venta", "precio unitario", "precio publico"],
  },
  {
    key: "Hechura",
    label: "Hechura",
    aliases: ["hechura", "labor", "mano de obra", "workmanship", "mdo", "lanzamiento"],
  },
  {
    key: "Hechura_Modo",
    label: "Modo hechura",
    aliases: ["modo hechura", "hechura modo", "hechura type", "tipo hechura"],
  },
  {
    key: "Merma_Pct",
    label: "Merma %",
    aliases: ["merma", "merma pct", "merma %", "merma porcentaje", "waste", "shrinkage", "perdida"],
  },
  {
    key: "Modo_Stock",
    label: "Modo de stock",
    aliases: ["modo stock", "stock mode", "modo_stock", "tipo stock", "control stock"],
  },
  {
    key: "Unidad",
    label: "Unidad de medida",
    aliases: ["unidad", "unit", "uom", "medida", "ud", "um", "unidad medida", "unidad de medida"],
  },
  {
    key: "Peso",
    label: "Peso (gramos)",
    aliases: ["peso", "weight", "gramos", "grams", "gram", "gr", "peso gramos", "peso total"],
  },
  {
    key: "Tipo",
    label: "Tipo de artículo",
    aliases: ["tipo", "type", "tipo articulo", "tipo_art", "article type", "kind"],
  },
  {
    key: "Estado",
    label: "Estado",
    aliases: ["estado", "status", "estatus", "estado articulo"],
  },
  {
    key: "Activo",
    label: "Activo",
    aliases: ["activo", "active", "habilitado", "enabled", "disponible", "vigente"],
  },
  {
    key: "Favorito",
    label: "Favorito",
    aliases: ["favorito", "favorite", "destacado", "featured"],
  },
  {
    key: "En_Tienda",
    label: "Visible en tienda",
    aliases: ["en tienda", "tienda", "store", "online", "visible", "publicado", "mostrar en tienda"],
  },
  {
    key: "Acepta_Devolucion",
    label: "Acepta devolución",
    aliases: ["acepta devolucion", "devolucion", "returnable", "return", "acepta devoluciones"],
  },
  {
    key: "Vender_Sin_Variantes",
    label: "Vender sin variantes",
    aliases: ["vender sin variantes", "sell without variants", "sin variantes"],
  },
  {
    key: "Reorder_Point",
    label: "Punto de reposición",
    aliases: ["reorder point", "punto reposicion", "reorder", "stock minimo", "stock min", "reposicion"],
  },
  {
    key: "Cant_Min",
    label: "Cantidad mínima",
    aliases: ["cant min", "cantidad minima", "min qty", "min quantity", "minimo", "min"],
  },
  {
    key: "Cant_Max",
    label: "Cantidad máxima",
    aliases: ["cant max", "cantidad maxima", "max qty", "max quantity", "maximo", "max"],
  },
  {
    key: "Cant_Default",
    label: "Cantidad por defecto",
    aliases: ["cant default", "cantidad default", "default qty", "cantidad predeterminada", "cantidad base"],
  },
  {
    key: "Es_Variante",
    label: "¿Es variante?",
    aliases: ["es variante", "es_variante", "variante", "is variant", "variant", "es var"],
  },
  {
    key: "Articulo_Padre",
    label: "Código artículo padre",
    aliases: ["articulo padre", "articulo_padre", "parent", "parent code", "codigo padre", "cod padre", "padre"],
  },
  {
    key: "Notas",
    label: "Notas",
    aliases: ["notas", "notes", "comentarios", "comments", "observaciones", "nota"],
  },
];
