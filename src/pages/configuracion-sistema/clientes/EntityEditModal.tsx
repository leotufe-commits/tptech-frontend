import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPComboCreatable from "../../../components/ui/TPComboCreatable";
import TPSelect from "../../../components/ui/TPSelect";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import TPAvatarUploader from "../../../components/ui/TPAvatarUploader";
import { cn } from "../../../components/ui/tp";
import { useCatalog } from "../../../hooks/useCatalog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  type EntityDetail as EntityDetailType,
  type EntityType,
  type EntityPayload,
} from "../../../services/commercial-entities";
import { priceListsApi, type PriceListRow } from "../../../services/price-lists";
import { listCurrencies, type CurrencyRow } from "../../../services/valuation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = "DATOS" | "COMERCIAL";

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
    entityType: "PERSON",
    isClient: isClientCtx || (!isClientCtx && !isSupplierCtx),
    isSupplier: isSupplierCtx,
    firstName: "",
    lastName: "",
    companyName: "",
    tradeName: "",
    email: "",
    phonePrefix: "",
    phoneNumber: "",
    documentType: "",
    documentNumber: "",
    ivaCondition: "",
    priceListId: null,
    currencyId: null,
    notes: "",
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
  onClose: () => void;
  onSaved: (entity: EntityDetailType) => void;
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
  onClose,
  onSaved,
}: Props) {
  const navigate = useNavigate();
  const isRoleFixed = isClientContext || isSupplierContext;

  const [tab, setTab] = useState<Tab>("DATOS");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(isClientContext, isSupplierContext));
  const [entity, setEntity] = useState<EntityDetailType | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);

  // Catalogs
  const docTypeCat = useCatalog("DOCUMENT_TYPE");
  const ivaCat = useCatalog("IVA_CONDITION");
  const prefixCat = useCatalog("PHONE_PREFIX");

  // Price lists + currencies
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);

  // Reset + load when modal opens
  useEffect(() => {
    if (!open) return;
    setTab("DATOS");
    setSubmitted(false);
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    setAvatarFile(null);

    if (mode === "CREATE") {
      setDraft(emptyDraft(isClientContext, isSupplierContext));
      setEntity(null);
    } else if (mode === "EDIT" && entityId) {
      setLoading(true);
      commercialEntitiesApi
        .getOne(entityId)
        .then((e) => { setEntity(e); setDraft(entityToDraft(e)); })
        .catch(() => toast.error("Error al cargar la entidad."))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, entityId]);

  useEffect(() => {
    priceListsApi.list().then((rows) => setPriceLists(rows.filter((p) => p.isActive))).catch(() => {});
    listCurrencies().then((resp: any) => {
      const list: CurrencyRow[] = resp?.rows ?? resp ?? [];
      setCurrencies(list.filter((c) => c.isActive));
    }).catch(() => {});
  }, []);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // Avatar
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

  // Submit
  async function handleSubmit() {
    setSubmitted(true);
    const d = { ...draft };
    if (isClientContext)   d.isClient   = true;
    if (isSupplierContext) d.isSupplier  = true;

    if (!d.isClient && !d.isSupplier) {
      toast.error("La entidad debe ser cliente, proveedor o ambos.");
      return;
    }
    if (d.entityType === "PERSON" && (!d.firstName.trim() || !d.lastName.trim())) {
      setTab("DATOS");
      return;
    }
    if (d.entityType === "COMPANY" && !d.companyName.trim()) {
      setTab("DATOS");
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
      balanceType: entity?.balanceType ?? "UNIFIED",
      priceListId: d.priceListId || null,
      currencyId: d.currencyId || null,
      creditLimitClient: entity?.creditLimitClient ?? null,
      creditLimitSupplier: entity?.creditLimitSupplier ?? null,
      notes: d.notes.trim(),
    };

    setBusy(true);
    try {
      if (mode === "CREATE") {
        const created = await commercialEntitiesApi.create(payload);
        if (avatarFile) {
          await commercialEntitiesApi.avatar.update(created.id, avatarFile).catch(() => {});
        }
        toast.success("Entidad creada.");
        onSaved(created);
        onClose();
        navigate(`/${isSupplierContext ? "proveedores" : "clientes"}/${created.id}`);
      } else {
        const updated = await commercialEntitiesApi.update(entity!.id, payload);
        toast.success("Entidad actualizada.");
        onSaved({ ...entity!, ...updated });
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "CREATE"
      ? isSupplierContext ? "Nuevo proveedor" : "Nuevo cliente"
      : entity?.displayName || "Editar entidad";

  const displayName =
    mode === "EDIT" && entity
      ? entity.displayName
      : draft.entityType === "PERSON"
        ? [draft.firstName, draft.lastName].filter(Boolean).join(" ") || (isSupplierContext ? "Proveedor" : "Cliente")
        : draft.companyName || (isSupplierContext ? "Proveedor" : "Cliente");

  const avatarSrc = mode === "EDIT" && entity?.avatarUrl ? entity.avatarUrl : "";
  const effectiveSrc = avatarPreview || avatarSrc;

  return (
    <Modal open={open} maxWidth="2xl" title={title} onClose={onClose} busy={busy} footer={null as any}>
      {loading ? (
        <div className="py-8 text-center text-sm text-muted">Cargando…</div>
      ) : (
        <div className="space-y-4">

          {/* ── Avatar card ── */}
          <div className="tp-card p-4">
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
                <div className="text-sm font-semibold">Imagen de perfil</div>
                <div className="text-xs text-muted">
                  {mode === "CREATE"
                    ? "Podés elegirla ahora (se sube al crear)."
                    : "Elegí una nueva para actualizar al instante."}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="tp-card p-1 flex items-center gap-1">
            {(["DATOS", "COMERCIAL"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                  tab === t
                    ? "bg-[var(--primary)] text-[var(--primary-foreground,#fff)]"
                    : "hover:bg-surface2"
                )}
              >
                {t === "DATOS" ? "Datos" : "Comercial"}
              </button>
            ))}
          </div>

          {/* ── Tab: Datos ── */}
          {tab === "DATOS" && (
            <div className="space-y-4">

              {/* Tipo */}
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Tipo de entidad</div>
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
                <TPField label="Tipo">
                  <TPSelect
                    value={draft.entityType}
                    onChange={(v) => set("entityType", v as EntityType)}
                    disabled={busy}
                    options={[
                      { value: "PERSON",  label: "Persona física" },
                      { value: "COMPANY", label: "Empresa" },
                    ]}
                  />
                </TPField>
              </TPCard>

              {/* Datos persona */}
              {draft.entityType === "PERSON" && (
                <TPCard className="p-4 space-y-4">
                  <div className="text-sm font-semibold">Datos de la persona</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TPField
                      label="Apellido *"
                      error={submitted && !draft.lastName.trim() ? "El apellido es obligatorio." : null}
                    >
                      <TPInput
                        value={draft.lastName}
                        onChange={(v) => set("lastName", v)}
                        disabled={busy}
                        placeholder="Ej: García"
                      />
                    </TPField>
                    <TPField
                      label="Nombre *"
                      error={submitted && !draft.firstName.trim() ? "El nombre es obligatorio." : null}
                    >
                      <TPInput
                        value={draft.firstName}
                        onChange={(v) => set("firstName", v)}
                        disabled={busy}
                        placeholder="Ej: Juan"
                      />
                    </TPField>
                  </div>
                </TPCard>
              )}

              {/* Datos empresa */}
              {draft.entityType === "COMPANY" && (
                <TPCard className="p-4 space-y-4">
                  <div className="text-sm font-semibold">Datos de la empresa</div>
                  <TPField
                    label="Razón social *"
                    error={submitted && !draft.companyName.trim() ? "La razón social es obligatoria." : null}
                  >
                    <TPInput
                      value={draft.companyName}
                      onChange={(v) => set("companyName", v)}
                      disabled={busy}
                      placeholder="Ej: Joyería SA"
                    />
                  </TPField>
                  <TPField label="Nombre de fantasía">
                    <TPInput
                      value={draft.tradeName}
                      onChange={(v) => set("tradeName", v)}
                      disabled={busy}
                      placeholder="Ej: Joyas del Sur"
                    />
                  </TPField>
                </TPCard>
              )}

              {/* Datos fiscales */}
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Datos fiscales</div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3">
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
                      mode="edit"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <TPField label="Nro. documento">
                      <TPInput
                        value={draft.documentNumber}
                        onChange={(v) => set("documentNumber", v)}
                        disabled={busy}
                        placeholder="20-12345678-9"
                      />
                    </TPField>
                  </div>
                  <div className="md:col-span-4">
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
                      mode="edit"
                    />
                  </div>
                </div>
              </TPCard>

              {/* Contacto primario */}
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Contacto primario</div>
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
                          mode="edit"
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
              </TPCard>

            </div>
          )}

          {/* ── Tab: Comercial ── */}
          {tab === "COMERCIAL" && (
            <div className="space-y-4">

              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Configuración comercial</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TPField label="Lista de precios" hint="Si no se asigna, se usa la lista favorita o general del sistema.">
                    <TPSelect
                      value={draft.priceListId ?? ""}
                      onChange={(v) => set("priceListId", v || null)}
                      disabled={busy}
                      options={[
                        { value: "", label: "— Heredar del sistema —" },
                        ...priceLists.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                  </TPField>
                  <TPField label="Moneda" hint="Si no se asigna, se usa la moneda base del sistema.">
                    <TPSelect
                      value={draft.currencyId ?? ""}
                      onChange={(v) => set("currencyId", v || null)}
                      disabled={busy}
                      options={[
                        { value: "", label: "— Moneda base del sistema —" },
                        ...currencies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
                      ]}
                    />
                  </TPField>
                </div>
              </TPCard>

              <TPCard className="p-4 space-y-3">
                <div className="text-sm font-semibold">Observaciones</div>
                <TPTextarea
                  value={draft.notes}
                  onChange={(v) => set("notes", v)}
                  disabled={busy}
                  minH={80}
                  placeholder="Notas internas sobre esta entidad…"
                />
              </TPCard>

            </div>
          )}

          {/* ── Footer ── */}
          <div className="pt-2 flex justify-end gap-3">
            <TPButton variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={() => void handleSubmit()} disabled={busy}>
              {busy ? "Guardando…" : mode === "CREATE" ? "Crear" : "Guardar"}
            </TPButton>
          </div>

        </div>
      )}
    </Modal>
  );
}
