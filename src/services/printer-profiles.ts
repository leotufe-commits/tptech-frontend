import { apiFetch } from "../lib/api";

export type PrinterType = "THERMAL" | "ZEBRA" | "A4" | "INKJET";

export type PrinterProfileRow = {
  id:              string;
  name:            string;
  type:            PrinterType;
  dpi:             number;
  pageWidthMm:     string;
  pageHeightMm:    string;
  marginTopMm:     string;
  marginLeftMm:    string;
  marginRightMm:   string;
  marginBottomMm:  string;
  gapHMm:          string;
  gapVMm:          string;
  columns:         number;
  isDefault:       boolean;
  isActive:        boolean;
  deletedAt:       string | null;
  createdAt:       string;
};

export type PrinterProfilePayload = {
  name:            string;
  type?:           PrinterType;
  dpi?:            number;
  pageWidthMm?:    number;
  pageHeightMm?:   number;
  marginTopMm?:    number;
  marginLeftMm?:   number;
  marginRightMm?:  number;
  marginBottomMm?: number;
  gapHMm?:         number;
  gapVMm?:         number;
  columns?:        number;
  isDefault?:      boolean;
  isActive?:       boolean;
};

export const PRINTER_TYPE_LABELS: Record<PrinterType, string> = {
  THERMAL: "Térmica",
  ZEBRA:   "Zebra",
  A4:      "Hoja A4",
  INKJET:  "Inkjet",
};

export const printerProfilesApi = {
  list: () =>
    apiFetch<PrinterProfileRow[]>("/printer-profiles", { on401: "throw" }),

  create: (data: PrinterProfilePayload) =>
    apiFetch<PrinterProfileRow>("/printer-profiles", { method: "POST", body: data, on401: "throw" }),

  update: (id: string, data: Partial<PrinterProfilePayload>) =>
    apiFetch<PrinterProfileRow>(`/printer-profiles/${id}`, { method: "PUT", body: data, on401: "throw" }),

  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`/printer-profiles/${id}`, { method: "DELETE", on401: "throw" }),
};

export const PRESET_PRINTERS: (PrinterProfilePayload & { name: string })[] = [
  {
    name: "Térmica 58mm (1 col)",
    type: "THERMAL", dpi: 203,
    pageWidthMm: 58, pageHeightMm: 297,
    marginTopMm: 2, marginLeftMm: 2, marginRightMm: 2, marginBottomMm: 2,
    gapHMm: 0, gapVMm: 2, columns: 1,
  },
  {
    name: "A4 — 3 columnas",
    type: "A4", dpi: 96,
    pageWidthMm: 210, pageHeightMm: 297,
    marginTopMm: 10, marginLeftMm: 8, marginRightMm: 8, marginBottomMm: 10,
    gapHMm: 4, gapVMm: 3, columns: 3,
  },
  {
    name: "A4 — 2 columnas",
    type: "A4", dpi: 96,
    pageWidthMm: 210, pageHeightMm: 297,
    marginTopMm: 10, marginLeftMm: 10, marginRightMm: 10, marginBottomMm: 10,
    gapHMm: 6, gapVMm: 4, columns: 2,
  },
];
