import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, X, User, Building2,
} from "lucide-react";
import { TabAddresses } from "../../entity-detail/tabs/TabAddresses";
import { TabContacts } from "../../entity-detail/tabs/TabContacts";

import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPComboCreatable from "../../../components/ui/TPComboCreatable";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import TPAvatarUploader from "../../../components/ui/TPAvatarUploader";
import TPDropzone from "../../../components/ui/TPDropzone";
import TPAttachmentList from "../../../components/ui/TPAttachmentList";
import { cn } from "../../../components/ui/tp";
import { useCatalog } from "../../../hooks/useCatalog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  commercialEntitiesExtApi,
  type EntityDetail as EntityDetailType,
  type EntityType,
  type BalanceType,
  type EntityAddress,
  type EntityContact,
  type EntityPayload,
  type CommercialApplyOn,
  type CommercialRuleType,
  type CommercialValueType,
} from "../../../services/commercial-entities";
import { priceListsApi, type PriceListRow } from "../../../services/price-lists";
import { MermaBlock } from "./MermaBlock";
import { listCurrencies, type CurrencyRow } from "../../../services/valuation";
import type { MermaOverrideDraft } from "./clientes.types";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type Draft = {
  entityType: EntityType;
  isClient: boolean;
  isSupplier: boolean;
  firstName: string;
  lastName: string;
  companyName: string;
  tradeName: string;
  email: string;
  phonePrefix: string;
  phoneNumber: string;
  documentType: string;
  documentNumber: string;
  ivaCondition: string;
  paymentTerm: string;
  balanceType: BalanceType;
  commercialApplyOn: CommercialApplyOn | "";
  commercialRuleType: CommercialRuleType | "";
  commercialValueType: CommercialValueType | "";
  commercialValue: number | null;
  creditLimitClient: number | null;
  creditLimitSupplier: number | null;
  priceListId: string | null;
  currencyId: string | null;
  notes: string;
};

function splitPhone(phone: string) {
  const parts = String(phone || "").trim().split(/\s+/).filter(Boolean);
  const phonePrefix = parts[0]?.startsWith("+") ? parts[0] : "";
  const phoneNumber = phonePrefix ? parts.slice(1).join(" ") : parts.join(" ");
  return { phonePrefix, phoneNumber };
}

function buildPhone(prefix: string, number: string) {
  return [prefix, number].map((v) => String(v || "").trim()).filter(Boolean).join(" ").trim();
}

function emptyDraft(isClientCtx: boolean, isSupplierCtx: boolean): Draft {
  return {
    entityType: isSupplierCtx && !isClientCtx ? "COMPANY" : "PERSON",
    isClient: isClientCtx || (!isClientCtx && !isSupplierCtx),
    isSupplier: isSupplierCtx,
    firstName: "", lastName: "", companyName: "", tradeName: "",
    email: "", phonePrefix: "", phoneNumber: "",
    documentType: "", documentNumber: "", ivaCondition: "", paymentTerm: "",
    balanceType: "UNIFIED",
    commercialApplyOn: "", commercialRuleType: "", commercialValueType: "", commercialValue: null,
    creditLimitClient: null, creditLimitSupplier: null,
    priceListId: null, currencyId: null, notes: "",
  };
}

function entityToDraft(e: EntityDetailType): Draft {
  const { phonePrefix, phoneNumber } = splitPhone(e.phone);
  return {
    entityType: e.entityType,
    isClient: e.isClient,
    isSupplier: e.isSupplier,
    firstName: e.firstName,
    lastName: e.lastName,
    companyName: e.companyName,
    tradeName: e.tradeName,
    email: e.email,
    phonePrefix,
    phoneNumber,
    documentType: e.documentType,
    documentNumber: e.documentNumber,
    ivaCondition: e.ivaCondition,
    paymentTerm: e.paymentTerm ?? "",
    balanceType: e.balanceType,
    commercialApplyOn: e.commercialApplyOn ?? "",
    commercialRuleType: e.commercialRuleType ?? "",
    commercialValueType: e.commercialValueType ?? "",
    commercialValue: e.commercialValue != null ? parseFloat(e.commercialValue) : null,
    creditLimitClient: e.creditLimitClient != null ? parseFloat(e.creditLimitClient) : null,
    creditLimitSupplier: e.creditLimitSupplier != null ? parseFloat(e.creditLimitSupplier) : null,
    priceListId: e.priceListId,
    currencyId: e.currencyId,
    notes: e.notes,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  open: boolean;
  mode: "CREATE" | "EDIT";
  entityId?: string | null;
  isClientContext?: boolean;
  isSupplierContext?: boolean;
  /** Si es true, omite la navegación automática tras crear (útil al abrir desde otro modal). */
  suppressNavigate?: boolean;
  onClose: () => void;
  onSaved: (entity: EntityDetailType) => void;
}

// ---------------------------------------------------------------------------
// Inline helpers
// ---------------------------------------------------------------------------
function SectionHead({ title, micro }: { title: string; micro: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-sm font-semibold">{title}</span>
      <p className="text-xs text-muted">{micro}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EntityEditModal({
  open,
  mode,
  entityId,
  isClientContext = false,
  isSupplierContext = false,
  suppressNavigate = false,
  onClose,
  onSaved,
}: Props) {
  const navigate = useNavigate();
  const isRoleFixed = isClientContext || isSupplierContext;
  const comboMode = mode === "CREATE" ? "create" : "edit";

  const [loading, setLoading] = useState(() => open && mode === "EDIT" && !!entityId);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftChanged, setDraftChanged] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(isClientContext, isSupplierContext));
  const [entity, setEntity] = useState<EntityDetailType | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);

  // Attachments
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<EntityDetailType["attachments"]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [busyUpload, setBusyUpload] = useState(false);

  // Addresses and contacts
  const [offlineAddresses, setOfflineAddresses] = useState<EntityAddress[]>([]);
  const [offlineContacts, setOfflineContacts] = useState<EntityContact[]>([]);
  const [liveAddresses, setLiveAddresses] = useState<EntityAddress[]>([]);
  const [liveContacts, setLiveContacts] = useState<EntityContact[]>([]);

  // CREATE-only: merma drafts
  const [mermaDrafts, setMermaDrafts] = useState<MermaOverrideDraft[]>([]);

  // Catalogs
  const docTypeCat    = useCatalog("DOCUMENT_TYPE");
  const ivaCat        = useCatalog("IVA_CONDITION");
  const paymentTermCat = useCatalog("PAYMENT_TERM");
  const prefixCat     = useCatalog("PHONE_PREFIX");

  // Lists
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);

  // ── Reset + load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setDraftChanged(false);
    setShowUnsavedDialog(false);
    setStagedFiles([]);
    setAttachments([]);
    setAttachmentsLoaded(false);
    setOfflineAddresses([]);
    setOfflineContacts([]);
    setLiveAddresses([]);
    setLiveContacts([]);
    setMermaDrafts([]);
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    setAvatarFile(null);

    if (mode === "CREATE") {
      setDraft(emptyDraft(isClientContext, isSupplierContext));
      setEntity(null);
    } else if (mode === "EDIT" && entityId) {
      setEntity(null);
      setDraft(emptyDraft(isClientContext, isSupplierContext));
      setLoading(true);
      commercialEntitiesApi
        .getOne(entityId)
        .then((e) => {
          setEntity(e);
          setDraft(entityToDraft(e));
          setAttachments(e.attachments ?? []);
          setAttachmentsLoaded(true);
          setLiveAddresses(e.addresses ?? []);
          setLiveContacts(e.contacts ?? []);
        })
        .catch(() => toast.error("Error al cargar la entidad."))
        .finally(() => setLoading(false));
    }

    priceListsApi.list().then((rows) => setPriceLists(rows.filter((p) => p.isActive))).catch(() => {});
    listCurrencies().then((resp: any) => {
      const list: CurrencyRow[] = resp?.rows ?? resp ?? [];
      setCurrencies(list.filter((c) => c.isActive));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, entityId]);

  // ── State helpers ───────────────────────────────────────────────────────────
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDraftChanged(true);
  }

  function handleClose() {
    if (draftChanged) { setShowUnsavedDialog(true); return; }
    onClose();
  }

  async function reloadLive() {
    if (!entity) return;
    try {
      const e = await commercialEntitiesApi.getOne(entity.id);
      setLiveAddresses(e.addresses ?? []);
      setLiveContacts(e.contacts ?? []);
    } catch {}
  }

  // ── Avatar ──────────────────────────────────────────────────────────────────
  function handleAvatarPick(file: File) {
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFile(file);
    if (mode === "EDIT" && entity) {
      setBusyAvatar(true);
      commercialEntitiesApi.avatar.update(entity.id, file)
        .then((r) => setEntity((prev) => prev ? { ...prev, avatarUrl: r.avatarUrl } : prev))
        .catch((e: any) => toast.error(e?.message || "Error al subir imagen."))
        .finally(() => setBusyAvatar(false));
    }
  }

  function handleAvatarRemove() {
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    setAvatarFile(null);
  }

  // ── Attachments (EDIT) ──────────────────────────────────────────────────────
  async function handleUploadAttachments(files: File[]) {
    if (!entity) return;
    setBusyUpload(true);
    try {
      const uploaded = await Promise.all(
        files.map((f) => commercialEntitiesApi.attachments.upload(entity.id, f))
      );
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} archivo${uploaded.length !== 1 ? "s" : ""} adjuntado${uploaded.length !== 1 ? "s" : ""}.`);
    } catch (e: any) {
      toast.error(e?.message || "Error al subir archivos.");
    } finally {
      setBusyUpload(false);
    }
  }

  async function handleDeleteAttachment(item: { id: string }) {
    if (!entity) return;
    setDeletingAttachmentId(item.id);
    try {
      await commercialEntitiesApi.attachments.remove(entity.id, item.id);
      setAttachments((prev) => prev.filter((a) => a.id !== item.id));
      toast.success("Adjunto eliminado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar adjunto.");
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitted(true);
    const d = { ...draft };
    if (isClientContext)   d.isClient   = true;
    if (isSupplierContext) d.isSupplier = true;

    if (!d.isClient && !d.isSupplier) {
      toast.error("La entidad debe ser cliente, proveedor o ambos.");
      return;
    }
    if (d.entityType === "PERSON" && (!d.firstName.trim() || !d.lastName.trim())) {
      return;
    }
    if (d.entityType === "COMPANY" && !d.tradeName.trim()) {
      return;
    }

    const payload: EntityPayload = {
      entityType: d.entityType,
      isClient: d.isClient,
      isSupplier: d.isSupplier,
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim(),
      companyName: d.companyName.trim(),
      tradeName: d.tradeName.trim(),
      email: d.email.trim(),
      phone: buildPhone(d.phonePrefix, d.phoneNumber),
      documentType: d.documentType.trim(),
      documentNumber: d.documentNumber.trim(),
      ivaCondition: d.ivaCondition.trim(),
      paymentTerm: d.paymentTerm.trim(),
      balanceType: d.balanceType,
      priceListId: d.priceListId || null,
      currencyId: d.currencyId || null,
      commercialApplyOn: (d.commercialApplyOn || null) as EntityPayload["commercialApplyOn"],
      commercialRuleType: (d.commercialRuleType || null) as EntityPayload["commercialRuleType"],
      commercialValueType: (d.commercialValueType || null) as EntityPayload["commercialValueType"],
      commercialValue: d.commercialValue != null ? String(d.commercialValue) : null,
      creditLimitClient: d.creditLimitClient != null ? String(d.creditLimitClient) : null,
      creditLimitSupplier: d.creditLimitSupplier != null ? String(d.creditLimitSupplier) : null,
      notes: d.notes.trim(),
    };

    setBusy(true);
    try {
      if (mode === "CREATE") {
        const created = await commercialEntitiesApi.create(payload);

        if (avatarFile) {
          await commercialEntitiesApi.avatar.update(created.id, avatarFile).catch(() => {});
        }
        if (stagedFiles.length > 0) {
          await Promise.allSettled(
            stagedFiles.map((f) => commercialEntitiesApi.attachments.upload(created.id, f))
          );
        }
        if (offlineAddresses.length > 0) {
          await Promise.allSettled(
            offlineAddresses.map((a) =>
              commercialEntitiesApi.addresses.create(created.id, {
                type: a.type,
                label: a.label,
                attn: a.attn,
                street: a.street,
                streetNumber: a.streetNumber,
                floor: a.floor,
                apartment: a.apartment,
                city: a.city,
                province: a.province,
                country: a.country,
                postalCode: a.postalCode,
                isDefault: a.isDefault,
              })
            )
          );
        }
        if (offlineContacts.length > 0) {
          await Promise.allSettled(
            offlineContacts.map((c) =>
              commercialEntitiesApi.contacts.create(created.id, {
                firstName: c.firstName,
                lastName: c.lastName,
                position: c.position,
                email: c.email,
                phonePrefix: c.phonePrefix,
                phone: c.phone,
                whatsapp: c.whatsapp,
                isPrimary: c.isPrimary,
                receivesDocuments: c.receivesDocuments,
                receivesPaymentsOrCollections: c.receivesPaymentsOrCollections,
                notes: c.notes,
              })
            )
          );
        }
        if (mermaDrafts.length > 0) {
          await Promise.allSettled(
            mermaDrafts.map((d) =>
              commercialEntitiesExtApi.merma.upsert(created.id, {
                variantId: d.variantId,
                role: d.role,
                mermaPercent: d.mermaPercent,
                notes: d.notes,
                isActive: d.isActive,
              })
            )
          );
        }

        toast.success("Entidad creada.");
        setDraftChanged(false);
        onSaved(created);
        onClose();
        if (!suppressNavigate) {
          navigate(`/${isSupplierContext && !isClientContext ? "proveedores" : "clientes"}/${created.id}`);
        }
      } else {
        const updated = await commercialEntitiesApi.update(entity!.id, payload);

        toast.success("Entidad actualizada.");
        setDraftChanged(false);
        onSaved({ ...entity!, ...updated });
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const personIsPrimary = draft.entityType === "PERSON";

  const title =
    mode === "CREATE"
      ? isSupplierContext && !isClientContext ? "Nuevo proveedor" : "Nuevo cliente"
      : entity?.displayName || "Editar entidad";

  const displayName =
    mode === "EDIT" && entity
      ? entity.displayName
      : draft.entityType === "PERSON"
        ? [draft.firstName, draft.lastName].filter(Boolean).join(" ") || (isSupplierContext && !isClientContext ? "Proveedor" : "Cliente")
        : draft.companyName || (isSupplierContext && !isClientContext ? "Proveedor" : "Cliente");

  const effectiveSrc = avatarPreview || (mode === "EDIT" && entity?.avatarUrl ? entity.avatarUrl : "");
  const showPriceList = draft.isClient || isClientContext;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal open={open} maxWidth="6xl" title={title} onClose={handleClose} busy={busy} footer={null as any}>
      {loading ? (
        <div className="py-12 text-center text-sm text-muted">Cargando…</div>
      ) : (
        <div className="space-y-4">

          {/* ── Avatar ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <TPAvatarUploader
              src={effectiveSrc}
              name={displayName}
              size={64}
              rounded="xl"
              disabled={busy || busyAvatar}
              loading={busyAvatar}
              addLabel="Agregar"
              editLabel="Editar"
              deleteLabel={avatarPreview ? "Descartar" : "Eliminar imagen"}
              onUpload={handleAvatarPick}
              onDelete={effectiveSrc ? handleAvatarRemove : undefined}
              frameClassName="border border-border/30"
            />
            <div>
              <div className="text-sm font-semibold">{displayName}</div>
              <div className="text-xs text-muted">
                {mode === "CREATE" ? "La imagen se sube al crear la entidad." : "Seleccioná una nueva imagen para actualizarla."}
              </div>
            </div>
          </div>

          {/* ── Tipo de entidad ──────────────────────────────────────────── */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex gap-2">
              {(
                [
                  { value: "PERSON",  icon: <User size={14} />,      label: "Persona física" },
                  { value: "COMPANY", icon: <Building2 size={14} />, label: "Empresa" },
                ] as const
              ).map((opt) => {
                const active = draft.entityType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busy}
                    onClick={() => set("entityType", opt.value as EntityType)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all focus:outline-none border",
                      active
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                        : "border-border text-muted hover:text-text hover:bg-surface2",
                      busy && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {!isRoleFixed && (
              <div className="flex flex-wrap gap-4">
                <TPCheckbox
                  checked={draft.isClient}
                  onChange={(v) => set("isClient", v)}
                  disabled={busy}
                  label={<span className="text-sm">Es cliente</span>}
                />
                <TPCheckbox
                  checked={draft.isSupplier}
                  onChange={(v) => set("isSupplier", v)}
                  disabled={busy}
                  label={<span className="text-sm">Es proveedor</span>}
                />
                {submitted && !draft.isClient && !draft.isSupplier && (
                  <div className="text-xs text-red-500 w-full">Debe ser cliente, proveedor o ambos.</div>
                )}
              </div>
            )}
          </div>

          {/* ── Identidad + Fiscal + Contacto ────────────────────────────── */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            <SectionHead
              title={personIsPrimary ? "Datos personales" : "Datos de la empresa"}
              micro={personIsPrimary
                ? "Nombre, apellido e información tributaria del titular"
                : "Nombre comercial, razón social e información tributaria"}
            />

            {/* Campos principales — misma grilla 2 col para ambos tipos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {personIsPrimary ? (
                <>
                  <TPField
                    label="Nombre *"
                    error={submitted && !draft.firstName.trim() ? "Requerido." : null}
                  >
                    <TPInput value={draft.firstName} onChange={(v) => set("firstName", v)} disabled={busy} placeholder="Juan" />
                  </TPField>
                  <TPField
                    label="Apellido *"
                    error={submitted && !draft.lastName.trim() ? "Requerido." : null}
                  >
                    <TPInput value={draft.lastName} onChange={(v) => set("lastName", v)} disabled={busy} placeholder="García" />
                  </TPField>
                  <TPField label="Nombre de fantasía">
                    <TPInput value={draft.tradeName} onChange={(v) => set("tradeName", v)} disabled={busy} placeholder="Joyas del Sur" />
                  </TPField>
                  <TPField label="Razón social" hint="Opcional — si factura como empresa.">
                    <TPInput value={draft.companyName} onChange={(v) => set("companyName", v)} disabled={busy} placeholder="Joyería SA" />
                  </TPField>
                </>
              ) : (
                <>
                  <TPField
                    label="Nombre de fantasía *"
                    error={submitted && !draft.tradeName.trim() ? "Requerido." : null}
                  >
                    <TPInput value={draft.tradeName} onChange={(v) => set("tradeName", v)} disabled={busy} placeholder="Joyas del Sur" />
                  </TPField>
                  <TPField label="Razón social" hint="Opcional — para documentos fiscales.">
                    <TPInput value={draft.companyName} onChange={(v) => set("companyName", v)} disabled={busy} placeholder="Joyería SA" />
                  </TPField>
                  <TPField label="Nombre del contacto">
                    <TPInput value={draft.firstName} onChange={(v) => set("firstName", v)} disabled={busy} placeholder="Juan" />
                  </TPField>
                  <TPField label="Apellido del contacto">
                    <TPInput value={draft.lastName} onChange={(v) => set("lastName", v)} disabled={busy} placeholder="García" />
                  </TPField>
                </>
              )}
            </div>

            {/* Documento + IVA */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <TPComboCreatable
                  label="Tipo doc."
                  type="DOCUMENT_TYPE"
                  items={docTypeCat.items}
                  loading={docTypeCat.loading}
                  value={draft.documentType}
                  onChange={(v) => set("documentType", v)}
                  placeholder="DNI / CUIT"
                  disabled={busy}
                  allowCreate
                  onRefresh={() => void docTypeCat.refresh()}
                  onCreate={async (label) => { await docTypeCat.createItem(label); set("documentType", label); }}
                  mode={comboMode}
                />
              </div>
              <div>
                <TPInput label="Nro. documento" value={draft.documentNumber} onChange={(v) => set("documentNumber", v)} disabled={busy} placeholder="20-12345678-9" />
              </div>
              <div>
                <TPComboCreatable
                  label="Condición IVA"
                  type="IVA_CONDITION"
                  items={ivaCat.items}
                  loading={ivaCat.loading}
                  value={draft.ivaCondition}
                  onChange={(v) => set("ivaCondition", v)}
                  placeholder="Resp. Inscripto…"
                  disabled={busy}
                  allowCreate
                  onRefresh={() => void ivaCat.refresh()}
                  onCreate={async (label) => { await ivaCat.createItem(label); set("ivaCondition", label); }}
                  mode={comboMode}
                />
              </div>
            </div>

            {/* Email + Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TPField label="Email">
                <TPInput
                  type="email"
                  value={draft.email}
                  onChange={(v) => set("email", v)}
                  disabled={busy}
                  placeholder="contacto@empresa.com"
                />
              </TPField>
              <TPField label="Teléfono">
                <div className="flex gap-2">
                  <div className="w-28 shrink-0">
                    <TPComboCreatable
                      type="PHONE_PREFIX"
                      items={prefixCat.items}
                      loading={prefixCat.loading}
                      value={draft.phonePrefix}
                      onChange={(v) => set("phonePrefix", v)}
                      placeholder="+54"
                      disabled={busy}
                      allowCreate
                      onRefresh={() => void prefixCat.refresh()}
                      onCreate={async (label) => { await prefixCat.createItem(label); set("phonePrefix", label); }}
                      mode={comboMode}
                    />
                  </div>
                  <div className="flex-1">
                    <TPInput
                      value={draft.phoneNumber}
                      onChange={(v) => set("phoneNumber", v)}
                      disabled={busy}
                      placeholder="11 1234 5678"
                    />
                  </div>
                </div>
              </TPField>
            </div>
          </div>

          {/* ── Ubicaciones ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <SectionHead
              title="Ubicaciones y domicilios"
              micro="Fiscal, comercial, entrega u otras"
            />
            {mode === "CREATE" ? (
              <TabAddresses
                offlineItems={offlineAddresses}
                onOfflineItemsChange={setOfflineAddresses}
                contacts={offlineContacts}
                entityName={draft.entityType === "COMPANY" ? draft.tradeName : [draft.firstName, draft.lastName].filter(Boolean).join(" ")}
                hideCountLabel
              />
            ) : (
              <TabAddresses
                entityId={entity?.id}
                data={liveAddresses}
                contacts={liveContacts}
                entityName={entity ? (entity.entityType === "COMPANY" ? entity.tradeName : [entity.firstName, entity.lastName].filter(Boolean).join(" ")) : ""}
                onReload={reloadLive}
                hideCountLabel
              />
            )}
          </div>

          {/* ── Contactos adicionales ────────────────────────────────────── */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <SectionHead
              title="Contactos adicionales"
              micro="Personas adicionales vinculadas a esta entidad"
            />
            {mode === "CREATE" ? (
              <TabContacts
                offlineItems={offlineContacts}
                onOfflineItemsChange={setOfflineContacts}
                hideCountLabel
              />
            ) : (
              <TabContacts
                entityId={entity?.id}
                data={liveContacts}
                onReload={reloadLive}
                hideCountLabel
              />
            )}
          </div>

          {/* ── Comercial ────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            <SectionHead
              title="Comercial"
              micro="Lista de precios, moneda y cuenta corriente"
            />
            <div className="space-y-3">
              {/* Lista de precios — ancho completo */}
              {showPriceList && (
                <TPField label="Lista de precios" hint="Si no se asigna, se usa la lista favorita o general del sistema.">
                  <TPComboFixed
                    value={draft.priceListId ?? ""}
                    onChange={(v) => set("priceListId", v || null)}
                    disabled={busy}
                    searchable
                    searchPlaceholder="Buscar lista…"
                    options={[
                      { value: "", label: "— Heredar del sistema —" },
                      ...priceLists.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </TPField>
              )}

              {/* Fila 1: Moneda | Tipo de saldo | Base de impuestos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TPField label="Moneda" hint="Si no se asigna, se usa la moneda base del sistema.">
                  <TPComboFixed
                    value={draft.currencyId ?? ""}
                    onChange={(v) => set("currencyId", v || null)}
                    disabled={busy}
                    searchable
                    searchPlaceholder="Buscar moneda…"
                    options={[
                      { value: "", label: "— Moneda base —" },
                      ...currencies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
                    ]}
                  />
                </TPField>
                <TPField label="Tipo de saldo">
                  <TPComboFixed
                    value={draft.balanceType}
                    onChange={(v) => set("balanceType", v as BalanceType)}
                    disabled={busy}
                    options={[
                      { value: "UNIFIED",   label: "Unificado" },
                      { value: "BREAKDOWN", label: "Desglosado" },
                    ]}
                  />
                </TPField>
                <TPField label="Base de impuestos" hint="Base sobre la que se calculan los impuestos por defecto.">
                  <TPComboFixed
                    value={draft.commercialApplyOn}
                    onChange={(v) => set("commercialApplyOn", v as CommercialApplyOn | "")}
                    disabled={busy}
                    options={[
                      { value: "",                label: "— Sin especificar —" },
                      { value: "TOTAL",           label: "Total" },
                      { value: "METAL",           label: "Precio metal" },
                      { value: "HECHURA",         label: "Solo hechura" },
                      { value: "METAL_Y_HECHURA", label: "Metal y hechura" },
                    ]}
                  />
                </TPField>
              </div>

              {/* Fila 2: Tipo de beneficio/recargo | Tipo de valor | Valor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TPField label="Tipo de beneficio o recargo" hint="Beneficio (bonificación) o recargo por defecto.">
                  <TPComboFixed
                    value={draft.commercialRuleType}
                    onChange={(v) => set("commercialRuleType", v as CommercialRuleType | "")}
                    disabled={busy}
                    options={[
                      { value: "",          label: "— Sin especificar —" },
                      { value: "BONUS",     label: "Beneficio" },
                      { value: "SURCHARGE", label: "Recargo" },
                    ]}
                  />
                </TPField>
                <TPField label="Tipo de valor">
                  <TPComboFixed
                    value={draft.commercialValueType}
                    onChange={(v) => set("commercialValueType", v as CommercialValueType | "")}
                    disabled={busy}
                    options={[
                      { value: "",             label: "— Sin especificar —" },
                      { value: "PERCENTAGE",   label: "Porcentaje (%)" },
                      { value: "FIXED_AMOUNT", label: "Monto fijo ($)" },
                    ]}
                  />
                </TPField>
                <TPField label="Valor" hint="Porcentaje o monto fijo del beneficio o recargo.">
                  <TPNumberInput
                    value={draft.commercialValue}
                    onChange={(v) => set("commercialValue", v)}
                    disabled={busy}
                    min={0}
                    placeholder="0"
                    suffix={draft.commercialValueType === "PERCENTAGE" ? "%" : undefined}
                    leftIcon={
                      draft.commercialValueType === "FIXED_AMOUNT"
                        ? <span className="text-xs font-medium">{currencies.find((c) => c.id === draft.currencyId)?.symbol ?? currencies.find((c) => c.isBase)?.symbol ?? "$"}</span>
                        : undefined
                    }
                  />
                </TPField>
              </div>

              {/* Término de pago */}
              <TPField label="Término de pago" hint="Condición de pago habitual para esta entidad.">
                <TPComboCreatable
                  type="PAYMENT_TERM"
                  items={paymentTermCat.items}
                  loading={paymentTermCat.loading}
                  value={draft.paymentTerm}
                  onChange={(v) => set("paymentTerm", v)}
                  placeholder="Contado, 30 días…"
                  disabled={busy}
                  allowCreate
                  onRefresh={() => void paymentTermCat.refresh()}
                  onCreate={async (label) => { await paymentTermCat.createItem(label); set("paymentTerm", label); }}
                  mode={comboMode}
                />
              </TPField>

              {/* ── Merma por variante ──────────────────────────────────── */}
              <MermaBlock
                entityId={mode === "EDIT" ? (entityId ?? null) : null}
                isClient={draft.isClient}
                isSupplier={draft.isSupplier}
                hasRelations={mode === "EDIT" ? (entity?.hasRelations ?? false) : false}
                disabled={busy}
                drafts={mode === "CREATE" ? mermaDrafts : undefined}
                onDraftsChange={mode === "CREATE" ? setMermaDrafts : undefined}
              />
            </div>
          </div>

          {/* ── Observaciones + Adjuntos ─────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="font-semibold text-sm mb-3">Observaciones</div>
              <TPTextarea
                value={draft.notes}
                onChange={(v) => set("notes", v)}
                disabled={busy}
                placeholder="Notas internas sobre esta entidad…"
              />
              <div className="text-[11px] leading-snug text-muted mt-2">
                Podés dejar aclaraciones internas sobre esta entidad.
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="font-semibold text-sm mb-3">Adjuntos</div>
              <div className="space-y-3">
                <TPDropzone
                  multiple
                  disabled={busy || busyUpload}
                  loading={busyUpload}
                  onFiles={mode === "CREATE"
                    ? (files) => setStagedFiles((prev) => [...prev, ...files])
                    : handleUploadAttachments
                  }
                />
                <TPAttachmentList
                  items={
                    mode === "CREATE"
                      ? stagedFiles.map((f, i) => ({
                          id: `staged-${i}`,
                          name: f.name,
                          mimeType: f.type,
                        }))
                      : attachments.map((a) => ({
                          id: a.id,
                          name: a.filename,
                          url: a.url,
                          mimeType: a.mimeType,
                        }))
                  }
                  loading={mode === "EDIT" && !attachmentsLoaded}
                  deletingId={deletingAttachmentId}
                  onView={(item) => item.url && window.open(item.url, "_blank")}
                  onDownload={(item) => {
                    if (!item.url) return;
                    const a = document.createElement("a");
                    a.href = item.url;
                    a.download = item.name;
                    a.click();
                  }}
                  onDelete={
                    mode === "CREATE"
                      ? (item) => {
                          const idx = parseInt(item.id.replace("staged-", ""), 10);
                          setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
                        }
                      : handleDeleteAttachment
                  }
                  emptyText="Sin adjuntos por ahora."
                />
                <div className="text-[11px] leading-snug text-muted">
                  Podés agregar o eliminar adjuntos cuando quieras.
                </div>
              </div>
            </div>

          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3">
            <TPButton variant="secondary" onClick={handleClose} disabled={busy} iconLeft={<X size={15} />}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={() => void handleSubmit()} disabled={busy} iconLeft={<Check size={15} />}>
              {busy ? "Guardando…" : mode === "CREATE" ? "Crear" : "Guardar"}
            </TPButton>
          </div>

        </div>
      )}

      {/* ── Diálogo de cambios sin guardar ───────────────────────── */}
      <ConfirmDeleteDialog
        open={showUnsavedDialog}
        title="Cambios sin guardar"
        description="Tenés cambios sin guardar. ¿Querés descartarlos?"
        confirmText="Descartar cambios"
        cancelText="Seguir editando"
        busy={false}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirm={() => { setShowUnsavedDialog(false); onClose(); }}
      />
    </Modal>
  );
}
