// src/lib/import-mapping/entityFields.ts
// Definición de campos de entidades comerciales para el sistema de mapeo.
// Las claves (key) son los nombres camelCase que espera el backend.

import type { FieldDef } from "./types";

export const ENTITY_FIELDS: FieldDef[] = [
  {
    key: "entityType",
    label: "Tipo de entidad",
    aliases: ["tipo entidad", "entitytype", "entity type", "tipo", "type", "tipo de entidad"],
    description: "PERSONA o EMPRESA",
  },
  {
    key: "firstName",
    label: "Nombre",
    aliases: ["nombre", "firstname", "first name", "nombre persona", "name"],
  },
  {
    key: "lastName",
    label: "Apellido",
    aliases: ["apellido", "lastname", "last name", "apellidos", "surname"],
  },
  {
    key: "companyName",
    label: "Razón social",
    aliases: ["razon social", "companyname", "company name", "razon", "company", "empresa", "razon social empresa"],
  },
  {
    key: "tradeName",
    label: "Nombre de fantasía",
    aliases: ["nombre de fantasia", "tradename", "trade name", "fantasia", "nombre fantasia", "nombre comercial"],
  },
  {
    key: "email",
    label: "Email",
    aliases: ["email", "correo", "mail", "e-mail", "correo electronico", "e mail"],
  },
  {
    key: "phone",
    label: "Teléfono",
    aliases: ["telefono", "phone", "tel", "celular", "movil", "mobile", "fono"],
  },
  {
    key: "documentType",
    label: "Tipo de documento",
    aliases: ["tipo documento", "documenttype", "document type", "tipo doc", "tipo_doc"],
  },
  {
    key: "documentNumber",
    label: "Número de documento",
    aliases: ["numero documento", "documentnumber", "document number", "documento", "dni", "cuit", "cuil", "nro doc", "nro documento"],
  },
  {
    key: "ivaCondition",
    label: "Condición IVA",
    aliases: ["condicion iva", "ivacondition", "iva condition", "iva", "condicion fiscal", "situacion iva"],
  },
  {
    key: "paymentTerm",
    label: "Término de pago",
    aliases: ["termino de pago", "paymentterm", "payment term", "plazo pago", "condicion pago", "forma pago"],
  },
  {
    key: "currencyCode",
    label: "Moneda habitual",
    aliases: ["moneda habitual", "moneda", "currency", "currencycode", "currency code"],
  },
  {
    key: "priceListName",
    label: "Lista de precios",
    aliases: ["lista de precios", "pricelistname", "price list", "lista precios", "lista"],
  },
  {
    key: "isActive",
    label: "Activo",
    aliases: ["activo", "isactive", "active", "habilitado", "enabled"],
  },
  {
    key: "notes",
    label: "Observaciones",
    aliases: ["observaciones", "notes", "notas", "comentarios", "obs"],
  },
  {
    key: "addressLabel",
    label: "Etiqueta dirección",
    aliases: ["etiqueta direccion", "addresslabel", "address label", "tipo domicilio"],
  },
  {
    key: "street",
    label: "Calle",
    aliases: ["calle", "street", "direccion", "domicilio", "address"],
  },
  {
    key: "streetNumber",
    label: "Número",
    aliases: ["numero", "streetnumber", "street number", "altura", "nro", "num"],
  },
  {
    key: "floor",
    label: "Piso",
    aliases: ["piso", "floor", "pl"],
  },
  {
    key: "apartment",
    label: "Dpto.",
    aliases: ["dpto", "apartment", "depto", "departamento", "apto", "apt"],
  },
  {
    key: "city",
    label: "Ciudad",
    aliases: ["ciudad", "city", "localidad", "poblacion", "municipio"],
  },
  {
    key: "province",
    label: "Provincia",
    aliases: ["provincia", "province", "estado", "region", "state"],
  },
  {
    key: "country",
    label: "País",
    aliases: ["pais", "country", "nacion"],
  },
  {
    key: "postalCode",
    label: "Código postal",
    aliases: ["codigo postal", "postalcode", "postal code", "cp", "zip", "zip code", "cod postal"],
  },
  {
    key: "contactFirstName",
    label: "Nombre contacto",
    aliases: ["nombre contacto", "contactfirstname", "contact first name", "contacto nombre"],
  },
  {
    key: "contactLastName",
    label: "Apellido contacto",
    aliases: ["apellido contacto", "contactlastname", "contact last name", "contacto apellido"],
  },
  {
    key: "contactPosition",
    label: "Cargo contacto",
    aliases: ["cargo contacto", "contactposition", "contact position", "cargo", "puesto"],
  },
  {
    key: "contactEmail",
    label: "Email contacto",
    aliases: ["email contacto", "contactemail", "contact email", "mail contacto"],
  },
  {
    key: "contactPhone",
    label: "Teléfono contacto",
    aliases: ["telefono contacto", "contactphone", "contact phone", "tel contacto"],
  },
  {
    key: "contactNotes",
    label: "Notas contacto",
    aliases: ["notas contacto", "contactnotes", "contact notes", "obs contacto"],
  },
];
