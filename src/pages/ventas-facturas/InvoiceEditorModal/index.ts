// src/pages/ventas-facturas/InvoiceEditorModal/index.ts
// ============================================================================
// Barrel del modal de edición de Factura.
//
// FASE 8.2 — descomposición progresiva del `InvoiceEditorModal` gigante
// (~4 800 líneas) en sub-componentes presentacionales puros.
//
// Patrón: igual que `src/components/pricing/` — sub-componentes pequeños,
// orchestrator delgado, helpers en `src/lib/sales/`.
//
// Estado actual:
//   ✅ DiscountCard          (FASE 8.2.1)
//   ✅ ShippingCard          (FASE 8.2.1)
//   ✅ TotalsHeroSection     (FASE 8.2.2)
//   ✅ LinesEditorSection    (FASE 8.2.2)
//   ✅ AddressPickerPopover  (FASE 8.2.3)
//   ✅ CurrencyFXModal       (FASE 8.2.3)
//   ✅ PaymentCard           (FASE 8.2.3)
//   ✅ InvoiceHeaderForm     (FASE 8.2.2b)
//   ✅ usePreviewFlow hook   (FASE 8.2.4b — vive en src/lib/sales/)
//   ✅ patchLine + handleClientPick + saveDraftToBackend (FASE 8.2.5 — helpers en src/lib/sales/)
// ============================================================================

export { DiscountCard, default as DiscountCardDefault } from "./DiscountCard";
export type { DiscountCardProps } from "./DiscountCard";

export { ShippingCard, default as ShippingCardDefault } from "./ShippingCard";
export type { ShippingCardProps } from "./ShippingCard";

export { TotalsHeroSection, default as TotalsHeroSectionDefault } from "./TotalsHeroSection";
export type { TotalsHeroSectionProps, TotalsHeroPreviewStatus } from "./TotalsHeroSection";

export { LinesEditorSection, default as LinesEditorSectionDefault } from "./LinesEditorSection";
export type { LinesEditorSectionProps } from "./LinesEditorSection";

export { AddressPickerPopover, default as AddressPickerPopoverDefault } from "./AddressPickerPopover";
export type { AddressPickerPopoverProps, AddressOption } from "./AddressPickerPopover";

export { CurrencyFXModal, default as CurrencyFXModalDefault } from "./CurrencyFXModal";
export type { CurrencyFXModalProps, FxDraftValue } from "./CurrencyFXModal";

export { PaymentCard, default as PaymentCardDefault } from "./PaymentCard";
export type { PaymentCardProps, PaymentRow } from "./PaymentCard";

export { InvoiceHeaderForm, default as InvoiceHeaderFormDefault } from "./InvoiceHeaderForm";
export type { InvoiceHeaderFormProps } from "./InvoiceHeaderForm";

export {
  ObservationsTermsAttachmentsCard,
  default as ObservationsTermsAttachmentsCardDefault,
} from "./ObservationsTermsAttachmentsCard";
export type { ObservationsTermsAttachmentsCardProps } from "./ObservationsTermsAttachmentsCard";
