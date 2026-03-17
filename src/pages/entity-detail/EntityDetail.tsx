import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Pencil, X, Check, MapPin, Users, FileText, Receipt, Paperclip, CreditCard, Camera } from "lucide-react";

import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPComboCreatable from "../../components/ui/TPComboCreatable";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPSelect from "../../components/ui/TPSelect";
import { TPCheckbox } from "../../components/ui/TPCheckbox";
import TPAlert from "../../components/ui/TPAlert";
import { TPButton } from "../../components/ui/TPButton";
import { TPIconButton } from "../../components/ui/TPIconButton";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPBadge } from "../../components/ui/TPBadges";
import { useCatalog } from "../../hooks/useCatalog";
import { toast } from "../../lib/toast";
import {
  commercialEntitiesApi,
  ENTITY_TYPE_LABELS,
  BALANCE_TYPE_LABELS,
  type EntityDetail as EntityDetailType,
  type EntityAddress,
  type EntityContact,
  type EntityAttachment,
  type EntityCommercialRule,
  type EntityTaxOverride,
  type EntityType,
  type BalanceType,
  type EntityPayload,
} from "../../services/commercial-entities";
import { priceListsApi, type PriceListRow } from "../../services/price-lists";
import { listCurrencies, type CurrencyRow } from "../../services/valuation";

import TPAttachmentManager from "../../components/ui/TPAttachmentManager";
import { TabAddresses } from "./tabs/TabAddresses";
import { TabContacts } from "./tabs/TabContacts";
import { TabAttachments } from "./tabs/TabAttachments";
import { TabRules } from "./tabs/TabRules";
import { TabTaxes } from "./tabs/TabTaxes";

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------
function splitPhone(phone: string): { phonePrefix: string; phoneNumber: string } {
  const parts = String(phone || "").trim().split(/\s+/).filter(Boolean);
  const phonePrefix = parts[0]?.startsWith("+") ? parts[0] : "";
  const phoneNumber = phonePrefix ? parts.slice(1).join(" ") : parts.join(" ");
  return { phonePrefix, phoneNumber };
}

function buildPhone(prefix: string, number: string): string {
  return [prefix, number]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------
type Tab = "general" | "addresses" | "contacts" | "rules" | "taxes" | "balance" | "attachments";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "general",     label: "General",           icon: <FileText size={14} /> },
  { key: "addresses",   label: "Direcciones",        icon: <MapPin size={14} /> },
  { key: "contacts",    label: "Contactos",          icon: <Users size={14} /> },
  { key: "rules",       label: "Reglas comerciales", icon: <Receipt size={14} /> },
  { key: "taxes",       label: "Impuestos",          icon: <FileText size={14} /> },
  { key: "balance",     label: "Cuenta corriente",   icon: <CreditCard size={14} /> },
  { key: "attachments", label: "Adjuntos",           icon: <Paperclip size={14} /> },
];

// ---------------------------------------------------------------------------
// Draft type for the edit form
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
  // phone split into two fields; combined on save
  phonePrefix: string;
  phoneNumber: string;
  documentType: string;
  documentNumber: string;
  ivaCondition: string;
  priceListId: string | null;
  currencyId: string | null;
  notes: string;
};

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

function draftToPayload(d: Draft, entity?: EntityDetailType | null): EntityPayload {
  return {
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
    // balance fields stay from entity (not editable in General tab)
    balanceType: entity?.balanceType ?? "UNIFIED",
    priceListId: d.priceListId || null,
    currencyId: d.currencyId || null,
    creditLimitClient: entity?.creditLimitClient ?? null,
    creditLimitSupplier: entity?.creditLimitSupplier ?? null,
    notes: d.notes.trim(),
  };
}

// ---------------------------------------------------------------------------
// TabBalance — sub-component for the "Cuenta corriente" tab
// ---------------------------------------------------------------------------
function TabBalance({
  entity,
  onUpdate,
}: {
  entity: EntityDetailType;
  onUpdate: (updated: EntityDetailType) => void;
}) {
  const [editing, setEditing]                     = useState(false);
  const [busy, setBusy]                           = useState(false);
  const [balanceType, setBalanceType]             = useState<BalanceType>(entity.balanceType);
  const [creditLimitClient, setCreditLimitClient] = useState<number | null>(
    entity.creditLimitClient != null ? parseFloat(entity.creditLimitClient) : null
  );
  const [creditLimitSupplier, setCreditLimitSupplier] = useState<number | null>(
    entity.creditLimitSupplier != null ? parseFloat(entity.creditLimitSupplier) : null
  );

  function startEdit() { setEditing(true); }

  function cancelEdit() {
    setBalanceType(entity.balanceType);
    setCreditLimitClient(entity.creditLimitClient != null ? parseFloat(entity.creditLimitClient) : null);
    setCreditLimitSupplier(entity.creditLimitSupplier != null ? parseFloat(entity.creditLimitSupplier) : null);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await commercialEntitiesApi.update(entity.id, {
        entityType: entity.entityType,
        isClient: entity.isClient,
        isSupplier: entity.isSupplier,
        firstName: entity.firstName,
        lastName: entity.lastName,
        companyName: entity.companyName,
        tradeName: entity.tradeName,
        email: entity.email,
        phone: entity.phone,
        documentType: entity.documentType,
        documentNumber: entity.documentNumber,
        ivaCondition: entity.ivaCondition,
        balanceType,
        priceListId: entity.priceListId ?? null,
        currencyId: entity.currencyId ?? null,
        creditLimitClient: creditLimitClient != null ? String(creditLimitClient) : null,
        creditLimitSupplier: creditLimitSupplier != null ? String(creditLimitSupplier) : null,
        notes: entity.notes,
      });
      onUpdate({ ...entity, ...updated });
      setEditing(false);
      toast.success("Configuración de cuenta guardada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  const showClient   = entity.isClient;
  const showSupplier = entity.isSupplier;

  return (
    <div className="space-y-4">

      {/* Edit / save row */}
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <TPButton variant="secondary" onClick={cancelEdit} disabled={busy}>
              <X size={14} className="mr-1" /> Cancelar
            </TPButton>
            <TPButton onClick={save} disabled={busy}>
              <Check size={14} className="mr-1" />
              {busy ? "Guardando…" : "Guardar"}
            </TPButton>
          </div>
        ) : (
          <TPButton variant="secondary" onClick={startEdit}>
            <Pencil size={14} className="mr-1" /> Editar
          </TPButton>
        )}
      </div>

      {/* Configuración de saldo */}
      <TPCard className="p-4 space-y-4">
        <div className="text-sm font-semibold">Configuración de saldo</div>

        <TPField label="Tipo de saldo">
          <TPSelect
            value={balanceType}
            onChange={(v) => editing && setBalanceType(v as BalanceType)}
            disabled={!editing || busy}
            options={[
              { value: "UNIFIED",   label: "Unificado — un saldo único (compras y ventas combinados)" },
              { value: "BREAKDOWN", label: "Separado — saldos independientes por rol" },
            ]}
          />
          <div className="mt-1 text-xs text-muted">
            {balanceType === "UNIFIED"
              ? "El saldo acumula todas las operaciones sin distinguir si la entidad actúa como cliente o proveedor."
              : "Se mantienen dos saldos separados: uno como cliente (ventas) y otro como proveedor (compras)."}
          </div>
        </TPField>

        {(showClient || showSupplier) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {showClient && (
              <TPField label="Límite de crédito (cliente)" hint="Vacío = sin límite">
                <TPNumberInput
                  value={creditLimitClient}
                  onChange={setCreditLimitClient}
                  decimals={2}
                  min={0}
                  disabled={!editing || busy}
                  placeholder="Sin límite"
                />
              </TPField>
            )}
            {showSupplier && (
              <TPField label="Límite de crédito (proveedor)" hint="Vacío = sin límite">
                <TPNumberInput
                  value={creditLimitSupplier}
                  onChange={setCreditLimitSupplier}
                  decimals={2}
                  min={0}
                  disabled={!editing || busy}
                  placeholder="Sin límite"
                />
              </TPField>
            )}
          </div>
        )}
      </TPCard>

      {/* Aviso sobre movimientos pendientes */}
      <TPAlert tone="neutral" title="Movimientos de cuenta corriente">
        Los débitos, créditos, facturas y pagos de esta entidad estarán disponibles
        cuando se implemente el módulo de Comprobantes.
      </TPAlert>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect context from URL path
  const isSupplierContext = location.pathname.startsWith("/proveedores");
  const isClientContext   = location.pathname.startsWith("/clientes");
  // When context is unambiguous, lock the role fields
  const isRoleFixed       = isClientContext || isSupplierContext;

  const backPath = isSupplierContext
    ? "/configuracion-sistema/proveedores"
    : "/configuracion-sistema/clientes";

  const createMode = id === "nuevo";

  // ---------------------------------------------------------------------------
  // Entity state
  // ---------------------------------------------------------------------------
  const [entity, setEntity]       = useState<EntityDetailType | null>(null);
  const [loading, setLoading]     = useState(!createMode);
  const [notFound, setNotFound]   = useState(false);

  // ---------------------------------------------------------------------------
  // Tab state
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const [addresses, setAddresses]                     = useState<EntityAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded]         = useState(false);
  const [addressesLoading, setAddressesLoading]       = useState(false);

  const [contacts, setContacts]                       = useState<EntityContact[]>([]);
  const [contactsLoaded, setContactsLoaded]           = useState(false);
  const [contactsLoading, setContactsLoading]         = useState(false);

  const [attachments, setAttachments]                 = useState<EntityAttachment[]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded]     = useState(false);
  const [attachmentsLoading, setAttachmentsLoading]   = useState(false);

  const [rules, setRules]                             = useState<EntityCommercialRule[]>([]);
  const [rulesLoaded, setRulesLoaded]                 = useState(false);
  const [rulesLoading, setRulesLoading]               = useState(false);

  const [taxOverrides, setTaxOverrides]               = useState<EntityTaxOverride[]>([]);
  const [taxOverridesLoaded, setTaxOverridesLoaded]   = useState(false);
  const [taxOverridesLoading, setTaxOverridesLoading] = useState(false);

  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);

  // ---------------------------------------------------------------------------
  // Edit / create form state
  // ---------------------------------------------------------------------------
  const [editing, setEditing]     = useState(createMode);
  const [draft, setDraft]         = useState<Draft | null>(
    createMode
      ? {
          entityType: "PERSON",
          isClient:   !isSupplierContext,
          isSupplier: isSupplierContext,
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
        }
      : null
  );
  const [submitted, setSubmitted]     = useState(false);
  const [busySave, setBusySave]       = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // ---------------------------------------------------------------------------
  // Avatar state
  // ---------------------------------------------------------------------------
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);

  // ---------------------------------------------------------------------------
  // Catalogs
  // ---------------------------------------------------------------------------
  const docTypeCat  = useCatalog("DOCUMENT_TYPE");
  const ivaCat      = useCatalog("IVA_CONDITION");
  const prefixCat   = useCatalog("PHONE_PREFIX");

  // ---------------------------------------------------------------------------
  // Fetch entity
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (createMode) return;
    if (!id) { setNotFound(true); setLoading(false); return; }
    void fetchEntity();
  }, [id]);

  async function fetchEntity() {
    setLoading(true);
    try {
      const data = await commercialEntitiesApi.getOne(id!);
      setEntity(data);
      setDraft(entityToDraft(data));
      setAddresses(data.addresses);
      setAddressesLoaded(true);
      setContacts(data.contacts);
      setContactsLoaded(true);
      setAttachments(data.attachments);
      setAttachmentsLoaded(true);
      setRules(data.commercialRules);
      setRulesLoaded(true);
      setTaxOverrides(data.taxOverrides);
      setTaxOverridesLoaded(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  // Load price lists + currencies (for General tab pickers)
  useEffect(() => {
    priceListsApi.list().then((rows) => setPriceLists(rows.filter((p) => p.isActive))).catch(() => {});
    // El endpoint /valuation/currencies devuelve { ok, rows } — extraer .rows
    listCurrencies().then((resp: any) => {
      const list: CurrencyRow[] = resp?.rows ?? resp ?? [];
      setCurrencies(list.filter((c) => c.isActive));
    }).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Tab change with lazy-load
  // ---------------------------------------------------------------------------
  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (createMode || !entity) return;
    if (tab === "addresses"    && !addressesLoaded)     void reloadAddresses();
    if (tab === "contacts"     && !contactsLoaded)      void reloadContacts();
    if (tab === "attachments"  && !attachmentsLoaded)   void reloadAttachments();
    if (tab === "rules"        && !rulesLoaded)         void reloadRules();
    if (tab === "taxes"        && !taxOverridesLoaded)  void reloadTaxOverrides();
  }

  async function reloadAddresses() {
    if (!entity) return;
    setAddressesLoading(true);
    try {
      setAddresses(await commercialEntitiesApi.addresses.list(entity.id));
      setAddressesLoaded(true);
    } catch (e: any) { toast.error(e?.message || "Error al cargar direcciones."); }
    finally { setAddressesLoading(false); }
  }

  async function reloadContacts() {
    if (!entity) return;
    setContactsLoading(true);
    try {
      setContacts(await commercialEntitiesApi.contacts.list(entity.id));
      setContactsLoaded(true);
    } catch (e: any) { toast.error(e?.message || "Error al cargar contactos."); }
    finally { setContactsLoading(false); }
  }

  async function reloadAttachments() {
    if (!entity) return;
    setAttachmentsLoading(true);
    try {
      setAttachments(await commercialEntitiesApi.attachments.list(entity.id));
      setAttachmentsLoaded(true);
    } catch (e: any) { toast.error(e?.message || "Error al cargar adjuntos."); }
    finally { setAttachmentsLoading(false); }
  }

  async function reloadRules() {
    if (!entity) return;
    setRulesLoading(true);
    try {
      setRules(await commercialEntitiesApi.rules.list(entity.id));
      setRulesLoaded(true);
    } catch (e: any) { toast.error(e?.message || "Error al cargar reglas comerciales."); }
    finally { setRulesLoading(false); }
  }

  async function reloadTaxOverrides() {
    if (!entity) return;
    setTaxOverridesLoading(true);
    try {
      setTaxOverrides(await commercialEntitiesApi.taxOverrides.list(entity.id));
      setTaxOverridesLoaded(true);
    } catch (e: any) { toast.error(e?.message || "Error al cargar configuración de impuestos."); }
    finally { setTaxOverridesLoading(false); }
  }

  // ---------------------------------------------------------------------------
  // Avatar upload
  // ---------------------------------------------------------------------------
  async function handleAvatarChange(file: File) {
    if (!entity) return;
    setBusyAvatar(true);
    try {
      const result = await commercialEntitiesApi.avatar.update(entity.id, file);
      setEntity((prev) => prev ? { ...prev, avatarUrl: result.avatarUrl } : prev);
      toast.success("Imagen actualizada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al subir imagen.");
    } finally {
      setBusyAvatar(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Edit / create form handlers
  // ---------------------------------------------------------------------------
  function startEdit() {
    if (!entity) return;
    setDraft(entityToDraft(entity));
    setSubmitted(false);
    setEditing(true);
  }

  function cancelEdit() {
    if (createMode) { navigate(backPath); return; }
    setEditing(false);
    setDraft(entity ? entityToDraft(entity) : null);
    setSubmitted(false);
  }

  async function saveEdit() {
    if (!draft) return;
    setSubmitted(true);

    // In fixed-role context, ensure the role is set
    if (isClientContext)   draft.isClient   = true;
    if (isSupplierContext) draft.isSupplier  = true;

    if (!draft.isClient && !draft.isSupplier) {
      toast.error("La entidad debe ser cliente, proveedor o ambos.");
      return;
    }
    if (draft.entityType === "PERSON" && (!draft.firstName.trim() || !draft.lastName.trim())) return;
    if (draft.entityType === "COMPANY" && !draft.companyName.trim()) return;

    setBusySave(true);
    try {
      const payload = draftToPayload(draft, entity);
      if (createMode) {
        const created = await commercialEntitiesApi.create(payload);
        // Upload staged attachments after creation
        if (stagedFiles.length > 0) {
          await Promise.allSettled(
            stagedFiles.map((f) => commercialEntitiesApi.attachments.upload(created.id, f))
          );
        }
        toast.success("Entidad creada.");
        const detailBase = isSupplierContext ? "proveedores" : "clientes";
        navigate(`/${detailBase}/${created.id}`, { replace: true });
      } else {
        const updated = await commercialEntitiesApi.update(entity!.id, payload);
        setEntity((prev) => prev ? { ...prev, ...updated } : prev);
        setEditing(false);
        setDraft(null);
        toast.success("Entidad actualizada.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (loading) {
    return <div className="p-8 text-sm text-muted">Cargando entidad…</div>;
  }

  if (!createMode && (notFound || !entity)) {
    return <div className="p-8 text-sm text-muted">Entidad no encontrada.</div>;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>

      {/* ── Header ── */}
      <div className="border-b border-border bg-card px-4 md:px-8 py-4">
        <div className="max-w-5xl mx-auto">

          {/* Back */}
          <TPButton
            variant="ghost"
            onClick={() => navigate(-1)}
            iconLeft={<ArrowLeft size={14} />}
            className="mb-3 text-sm text-muted"
          >
            Volver al listado
          </TPButton>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">

              {/* Avatar */}
              {!createMode && entity && (
                <div className="relative shrink-0">
                  <div
                    className="h-14 w-14 rounded-full overflow-hidden border-2 border-border bg-surface cursor-pointer"
                    onClick={() => !busyAvatar && avatarInputRef.current?.click()}
                    title="Cambiar imagen"
                  >
                    {entity.avatarUrl ? (
                      <img src={entity.avatarUrl} alt={entity.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-sm font-bold text-primary bg-primary/10">
                        {entity.displayName
                          .split(/[\s,]+/)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <TPIconButton
                    className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-border"
                    onClick={() => !busyAvatar && avatarInputRef.current?.click()}
                    disabled={busyAvatar}
                    title="Cambiar imagen"
                  >
                    <Camera size={11} />
                  </TPIconButton>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleAvatarChange(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* Name / title */}
              <div className="min-w-0">
                {createMode ? (
                  <h1 className="text-xl font-semibold text-text">
                    {isSupplierContext ? "Nuevo proveedor" : "Nuevo cliente"}
                  </h1>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-semibold text-text truncate">
                        {entity!.displayName}
                      </h1>
                      <span className="text-xs font-mono px-2 py-0.5 rounded border border-border text-muted bg-surface">
                        {entity!.code}
                      </span>
                      <TPStatusPill active={entity!.isActive} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {entity!.isClient   && <TPBadge tone="primary" size="sm">Cliente</TPBadge>}
                      {entity!.isSupplier && <TPBadge tone="warning" size="sm">Proveedor</TPBadge>}
                      <TPBadge tone="neutral" size="sm">{ENTITY_TYPE_LABELS[entity!.entityType]}</TPBadge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <TPButton variant="secondary" onClick={cancelEdit} disabled={busySave}>
                    <X size={14} className="mr-1" /> Cancelar
                  </TPButton>
                  <TPButton variant="primary" onClick={saveEdit} disabled={busySave}>
                    <Check size={14} className="mr-1" />
                    {busySave ? "Guardando…" : createMode ? "Crear entidad" : "Guardar cambios"}
                  </TPButton>
                </>
              ) : (
                <TPButton variant="secondary" onClick={startEdit}>
                  <Pencil size={14} className="mr-1" /> Editar
                </TPButton>
              )}
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-0.5">
            {TABS.filter((t) => !createMode || t.key === "general").map((tab) => (
              <TPButton
                key={tab.key}
                variant={activeTab === tab.key ? "primary" : "ghost"}
                onClick={() => handleTabChange(tab.key)}
                iconLeft={tab.icon}
                className="text-xs whitespace-nowrap px-3 py-1.5 h-auto"
              >
                {tab.label}
              </TPButton>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">

        {/* ── Tab: General ── */}
        {activeTab === "general" && (
          <div className="space-y-4">

            {/* Roles y tipo — ocultos cuando el contexto ya fija el rol */}
            {!isRoleFixed && (
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Roles y tipo de entidad</div>
                <div className="flex flex-wrap gap-4">
                  <TPCheckbox
                    checked={editing ? draft!.isClient : entity!.isClient}
                    onChange={(v) => editing && set("isClient", v)}
                    disabled={!editing || busySave}
                    label={<span className="text-sm">Es cliente</span>}
                  />
                  <TPCheckbox
                    checked={editing ? draft!.isSupplier : entity!.isSupplier}
                    onChange={(v) => editing && set("isSupplier", v)}
                    disabled={!editing || busySave}
                    label={<span className="text-sm">Es proveedor</span>}
                  />
                </div>
                {submitted && editing && draft && !draft.isClient && !draft.isSupplier && (
                  <div className="text-xs text-red-500">Debe ser cliente, proveedor o ambos.</div>
                )}
                <TPField label="Tipo">
                  <TPSelect
                    value={editing ? draft!.entityType : entity!.entityType}
                    onChange={(v) => editing && set("entityType", v as EntityType)}
                    disabled={!editing || busySave}
                    options={[
                      { value: "PERSON",  label: "Persona física" },
                      { value: "COMPANY", label: "Empresa" },
                    ]}
                  />
                </TPField>
              </TPCard>
            )}

            {/* Tipo de entidad (solo el combo, sin los checks) cuando el rol está fijo */}
            {isRoleFixed && (
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Tipo de entidad</div>
                <TPField label="Tipo">
                  <TPSelect
                    value={editing ? draft!.entityType : entity!.entityType}
                    onChange={(v) => editing && set("entityType", v as EntityType)}
                    disabled={!editing || busySave}
                    options={[
                      { value: "PERSON",  label: "Persona física" },
                      { value: "COMPANY", label: "Empresa" },
                    ]}
                  />
                </TPField>
              </TPCard>
            )}

            {/* Datos persona */}
            {(editing ? draft!.entityType : entity!.entityType) === "PERSON" && (
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Datos de la persona</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TPField
                    label="Apellido *"
                    error={submitted && editing && !draft!.lastName.trim() ? "El apellido es obligatorio." : null}
                  >
                    <TPInput
                      value={editing ? draft!.lastName : entity!.lastName}
                      onChange={(v) => editing && set("lastName", v)}
                      disabled={!editing || busySave}
                      placeholder="Ej: García"
                    />
                  </TPField>
                  <TPField
                    label="Nombre *"
                    error={submitted && editing && !draft!.firstName.trim() ? "El nombre es obligatorio." : null}
                  >
                    <TPInput
                      value={editing ? draft!.firstName : entity!.firstName}
                      onChange={(v) => editing && set("firstName", v)}
                      disabled={!editing || busySave}
                      placeholder="Ej: Juan"
                    />
                  </TPField>
                </div>
              </TPCard>
            )}

            {/* Datos empresa */}
            {(editing ? draft!.entityType : entity!.entityType) === "COMPANY" && (
              <TPCard className="p-4 space-y-4">
                <div className="text-sm font-semibold">Datos de la empresa</div>
                <TPField
                  label="Razón social *"
                  error={submitted && editing && !draft!.companyName.trim() ? "La razón social es obligatoria." : null}
                >
                  <TPInput
                    value={editing ? draft!.companyName : entity!.companyName}
                    onChange={(v) => editing && set("companyName", v)}
                    disabled={!editing || busySave}
                    placeholder="Ej: Joyería SA"
                  />
                </TPField>
                <TPField label="Nombre de fantasía">
                  <TPInput
                    value={editing ? draft!.tradeName : entity!.tradeName}
                    onChange={(v) => editing && set("tradeName", v)}
                    disabled={!editing || busySave}
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
                    value={editing ? draft!.documentType : entity!.documentType}
                    onChange={(v) => editing && set("documentType", v)}
                    placeholder="DNI / CUIT"
                    disabled={!editing || busySave}
                    allowCreate
                    onRefresh={() => void docTypeCat.refresh()}
                    onCreate={async (label) => { await docTypeCat.createItem(label); editing && set("documentType", label); }}
                    mode={editing ? "edit" : "create"}
                  />
                </div>
                <div className="md:col-span-5">
                  <TPField label="Nro. documento">
                    <TPInput
                      value={editing ? draft!.documentNumber : entity!.documentNumber}
                      onChange={(v) => editing && set("documentNumber", v)}
                      disabled={!editing || busySave}
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
                    value={editing ? draft!.ivaCondition : entity!.ivaCondition}
                    onChange={(v) => editing && set("ivaCondition", v)}
                    placeholder="Resp. Inscripto…"
                    disabled={!editing || busySave}
                    allowCreate
                    onRefresh={() => void ivaCat.refresh()}
                    onCreate={async (label) => { await ivaCat.createItem(label); editing && set("ivaCondition", label); }}
                    mode={editing ? "edit" : "create"}
                  />
                </div>
              </div>
            </TPCard>

            {/* Contacto primario — teléfono separado en prefijo + número */}
            <TPCard className="p-4 space-y-4">
              <div className="text-sm font-semibold">Contacto primario</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TPField label="Email">
                  <TPInput
                    type="email"
                    value={editing ? draft!.email : entity!.email}
                    onChange={(v) => editing && set("email", v)}
                    disabled={!editing || busySave}
                    placeholder="contacto@empresa.com"
                  />
                </TPField>
                {/* Teléfono: prefijo (catálogo) + número */}
                <TPField label="Teléfono">
                  <div className="flex gap-2">
                    <div className="w-32 shrink-0">
                      {editing ? (
                        <TPComboCreatable
                          type="PHONE_PREFIX"
                          items={prefixCat.items}
                          loading={prefixCat.loading}
                          value={draft!.phonePrefix}
                          onChange={(v) => set("phonePrefix", v)}
                          placeholder="+54"
                          disabled={busySave}
                          allowCreate
                          onRefresh={() => void prefixCat.refresh()}
                          onCreate={async (label) => { await prefixCat.createItem(label); set("phonePrefix", label); }}
                          mode="edit"
                        />
                      ) : (
                        <div className="text-sm text-text py-1.5">
                          {splitPhone(entity?.phone ?? "").phonePrefix || <span className="text-muted italic">—</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <TPInput
                        value={editing ? draft!.phoneNumber : splitPhone(entity?.phone ?? "").phoneNumber}
                        onChange={(v) => editing && set("phoneNumber", v)}
                        disabled={!editing || busySave}
                        placeholder="11 1234 5678"
                      />
                    </div>
                  </div>
                </TPField>
              </div>
              <div className="text-xs text-muted">
                Los contactos adicionales (personas de contacto) se gestionan en el tab Contactos.
              </div>
            </TPCard>

            {/* Configuración comercial */}
            <TPCard className="p-4 space-y-4">
              <div className="text-sm font-semibold">Configuración comercial</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TPField label="Lista de precios" hint={editing ? "Si no se asigna, se usa la lista favorita o general del sistema." : undefined}>
                  {editing ? (
                    <TPSelect
                      value={draft!.priceListId ?? ""}
                      onChange={(v) => set("priceListId", v || null)}
                      disabled={busySave}
                      options={[
                        { value: "", label: "— Heredar del sistema —" },
                        ...priceLists.map((p) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                  ) : (
                    <div className="text-sm text-text py-1.5">
                      {entity!.priceListId
                        ? (priceLists.find((p) => p.id === entity!.priceListId)?.name ?? entity!.priceListId)
                        : <span className="text-muted italic">Hereda lista general del sistema</span>}
                    </div>
                  )}
                </TPField>
                <TPField label="Moneda" hint={editing ? "Si no se asigna, se usa la moneda base del sistema." : undefined}>
                  {editing ? (
                    <TPSelect
                      value={draft!.currencyId ?? ""}
                      onChange={(v) => set("currencyId", v || null)}
                      disabled={busySave}
                      options={[
                        { value: "", label: "— Moneda base del sistema —" },
                        ...currencies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
                      ]}
                    />
                  ) : (
                    <div className="text-sm text-text py-1.5">
                      {entity!.currencyId
                        ? (() => {
                            const c = currencies.find((x) => x.id === entity!.currencyId);
                            return c ? `${c.code} — ${c.name}` : entity!.currencyId;
                          })()
                        : <span className="text-muted italic">Hereda moneda base del sistema</span>}
                    </div>
                  )}
                </TPField>
              </div>
            </TPCard>

            {/* Observaciones */}
            <TPCard className="p-4 space-y-3">
              <div className="text-sm font-semibold">Observaciones</div>
              <TPTextarea
                value={editing ? draft!.notes : entity!.notes}
                onChange={(v) => editing && set("notes", v)}
                disabled={!editing || busySave}
                minH={80}
                placeholder="Notas internas sobre esta entidad…"
              />
            </TPCard>

            {/* Adjuntos — solo en create mode (antes de que exista el registro) */}
            {createMode && (
              <TPCard className="p-4 space-y-3">
                <div className="text-sm font-semibold">Adjuntos</div>
                <div className="text-xs text-muted mb-1">
                  Podés adjuntar archivos ahora. Se subirán al guardar la entidad.
                </div>
                <TPAttachmentManager
                  items={stagedFiles.map((f, i) => ({
                    id: `staged-${i}`,
                    name: f.name,
                    url: "",
                    mimeType: f.type,
                  }))}
                  onUpload={(files) => setStagedFiles((prev) => [...prev, ...files])}
                  onDelete={(item) => {
                    const idx = parseInt(item.id.replace("staged-", ""), 10);
                    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  uploadVariant="button"
                  disabled={busySave}
                  emptyText="Sin adjuntos por ahora."
                />
              </TPCard>
            )}

          </div>
        )}

        {/* ── Tab: Direcciones ── */}
        {activeTab === "addresses" && entity && (
          <TabAddresses
            entityId={entity.id}
            data={addresses}
            loading={addressesLoading}
            onReload={reloadAddresses}
          />
        )}

        {/* ── Tab: Contactos ── */}
        {activeTab === "contacts" && entity && (
          <TabContacts
            entityId={entity.id}
            data={contacts}
            loading={contactsLoading}
            onReload={reloadContacts}
          />
        )}

        {/* ── Tab: Reglas comerciales ── */}
        {activeTab === "rules" && entity && (
          <TabRules
            entityId={entity.id}
            data={rules}
            loading={rulesLoading}
            onReload={reloadRules}
          />
        )}

        {/* ── Tab: Impuestos ── */}
        {activeTab === "taxes" && entity && (
          <TabTaxes
            entityId={entity.id}
            data={taxOverrides}
            loading={taxOverridesLoading}
            onReload={reloadTaxOverrides}
          />
        )}

        {/* ── Tab: Cuenta corriente ── */}
        {activeTab === "balance" && entity && (
          <TabBalance
            entity={entity}
            onUpdate={(updated) => setEntity(updated)}
          />
        )}

        {/* ── Tab: Adjuntos ── */}
        {activeTab === "attachments" && entity && (
          <TabAttachments
            entityId={entity.id}
            data={attachments}
            loading={attachmentsLoading}
            onReload={reloadAttachments}
          />
        )}

      </div>
    </div>
  );
}
