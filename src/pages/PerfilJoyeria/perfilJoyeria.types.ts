// src/pages/PerfilJoyeria/perfilJoyeria.types.ts

export type EmailConfigBody = {
  // Bloque 1 — Identidad
  emailEnabled:        boolean;
  emailSenderName:     string;
  emailLogoUrl:        string;
  emailSignature:      string;
  // Bloque 2 — Contacto
  emailReplyTo:        string;
  emailContact:        string;
  emailPhone:          string;
  emailWhatsapp:       string;
  // Bloque 3 — Pie
  emailAddressLine:    string;
  emailBusinessHours:  string;
  emailWebsite:        string;
  emailInstagram:      string;
  emailFooter:         string;
};

export type ExistingBody = {
  name: string;
  phoneCountry: string;
  phoneNumber: string;

  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

export type CompanyBody = {
  logoUrl: string;

  legalName: string;
  cuit: string;
  ivaCondition: string;
  email: string;
  website: string;

  notes: string;
};

export type JewelryAttachment = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt?: string;
};

export type UpdatePayload = ExistingBody &
  Partial<CompanyBody> &
  Partial<EmailConfigBody>;

// ✅ Tipo mínimo del “Jewelry” que esta pantalla usa.
// No dependemos del Prisma completo; solo lo necesario.
export type JewelryProfile = ExistingBody &
  CompanyBody &
  EmailConfigBody & {
    id: string;
    updatedAt?: string;
    attachments?: JewelryAttachment[];
  };