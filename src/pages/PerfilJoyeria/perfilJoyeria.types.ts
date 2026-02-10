// src/pages/perfilJoyeria/perfilJoyeria.types.ts

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

export type UpdatePayload = ExistingBody & {
  logoUrl?: string;
  legalName?: string;
  cuit?: string;
  ivaCondition?: string;
  email?: string;
  website?: string;
  notes?: string;
};
