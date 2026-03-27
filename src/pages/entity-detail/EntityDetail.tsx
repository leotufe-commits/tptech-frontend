import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Pencil, X, Check, FileText, Receipt, CreditCard, Mail, Phone, Plus, Building2, MapPin, Users, Tag, Receipt as ReceiptIcon, StickyNote, Paperclip, Loader2, MoreVertical, Trash2, Power, PowerOff, UserPlus, ShoppingCart, ShoppingBag, Banknote, BarChart2, Percent, Link2 } from "lucide-react";

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
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPBadge } from "../../components/ui/TPBadges";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPInfoCard } from "../../components/ui/TPInfoCard";
import { useCatalog } from "../../hooks/useCatalog";
import { toast } from "../../lib/toast";
import {
  commercialEntitiesApi,
  ENTITY_TYPE_LABELS,
  BALANCE_TYPE_LABELS,
  COMMERCIAL_APPLY_ON_LABELS,
  COMMERCIAL_RULE_TYPE_LABELS,
  type EntityDetail as EntityDetailType,
  type EntityAddress,
  type EntityContact,
  type EntityAttachment,
  type EntityType,
  type BalanceType,
  type EntityPayload,
  type CommercialApplyOn,
  type CommercialRuleType,
  type CommercialValueType,
} from "../../services/commercial-entities";
import { priceListsApi, type PriceListRow } from "../../services/price-lists";
import { listCurrencies, type CurrencyRow } from "../../services/valuation";

import TPComboFixed from "../../components/ui/TPComboFixed";
import TPDropzone from "../../components/ui/TPDropzone";
import TPAttachmentList from "../../components/ui/TPAttachmentList";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { Modal } from "../../components/ui/Modal";
import TPAvatarUploader from "../../components/ui/TPAvatarUploader";
import { cn } from "../../components/ui/tp";
import { TabAddresses } from "./tabs/TabAddresses";
import { TabContacts } from "./tabs/TabContacts";
import TabMerma from "./tabs/TabMerma";
import TabRelations from "./tabs/TabRelations";
import EntityEditModal from "../configuracion-sistema/clientes/EntityEditModal";

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
type Tab = "general" | "transactions" | "balance";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "general",      label: "General",          icon: <FileText size={14} /> },
  { key: "transactions", label: "Transacciones",    icon: <Receipt size={14} /> },
  { key: "balance",      label: "Estado de cuenta", icon: <CreditCard size={14} /> },
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
  balanceType: BalanceType;
  commercialApplyOn: CommercialApplyOn | "";
  commercialRuleType: CommercialRuleType | "";
  commercialValueType: CommercialValueType | "";
  commercialValue: number | null;
  paymentTerm: string;
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
    balanceType: e.balanceType,
    commercialApplyOn: e.commercialApplyOn ?? "",
    commercialRuleType: e.commercialRuleType ?? "",
    commercialValueType: e.commercialValueType ?? "",
    commercialValue: e.commercialValue != null ? parseFloat(e.commercialValue) : null,
    paymentTerm: e.paymentTerm ?? "",
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
    balanceType: d.balanceType,
    priceListId: d.priceListId || null,
    currencyId: d.currencyId || null,
    commercialApplyOn: (d.commercialApplyOn || null) as EntityPayload["commercialApplyOn"],
    commercialRuleType: (d.commercialRuleType || null) as EntityPayload["commercialRuleType"],
    commercialValueType: (d.commercialValueType || null) as EntityPayload["commercialValueType"],
    commercialValue: d.commercialValue != null ? String(d.commercialValue) : null,
    paymentTerm: d.paymentTerm,
    creditLimitClient: entity?.creditLimitClient ?? null,
    creditLimitSupplier: entity?.creditLimitSupplier ?? null,
    notes: d.notes.trim(),
  };
}

// ---------------------------------------------------------------------------
// Visual helpers — section badges, headers, identity card styling
// ---------------------------------------------------------------------------
type BadgeVariant = "persona" | "empresa" | "fiscal" | "operativo" | "compartido";

function SectionBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  const styles: Record<BadgeVariant, string> = {
    persona:    "bg-blue-50   text-blue-600   border-blue-200",
    empresa:    "bg-amber-50  text-amber-700  border-amber-200",
    fiscal:     "bg-purple-50 text-purple-700 border-purple-200",
    operativo:  "bg-teal-50   text-teal-700   border-teal-200",
    compartido: "bg-slate-100 text-slate-600  border-slate-200",
  };
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
      styles[variant]
    )}>
      {label}
    </span>
  );
}

function SectionHead({
  title, micro, badge, variant, icon,
}: {
  title: string;
  micro: string;
  badge?: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="text-sm font-semibold">{title}</span>
        {badge && variant && <SectionBadge label={badge} variant={variant} />}
      </div>
      <p className="text-xs text-muted">{micro}</p>
    </div>
  );
}

function PrimaryBadge() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-[var(--primary)]">
      Principal
    </span>
  );
}

function identityCardClasses(isPrimary: boolean): string {
  return cn(
    "p-4 space-y-3 transition-all",
    isPrimary
      ? "border-[var(--primary)] ring-1 ring-[var(--primary)]"
      : "border-border opacity-65"
  );
}

function FactPair({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium text-muted uppercase tracking-wide leading-none mb-0.5">{label}</div>
      <div className="text-sm text-text leading-snug">
        {value ? value : <span className="text-muted/40 italic text-xs">—</span>}
      </div>
    </div>
  );
}

function QuickActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-text hover:bg-surface2 hover:border-primary/40 active:scale-95 transition-all"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

function EntitySectionCard({
  icon,
  title,
  count,
  onAdd,
  busyAdd = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  onAdd?: () => void;
  busyAdd?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface/30 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] bg-border/40 text-muted rounded-full px-1.5 py-0.5 font-medium tabular-nums">{count}</span>
          )}
        </div>
        {onAdd && (
          <button
            type="button"
            disabled={busyAdd}
            onClick={onAdd}
            className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/60 disabled:opacity-50 transition-colors"
          >
            {busyAdd ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown de acciones de la entidad
// ---------------------------------------------------------------------------
function DdSep() {
  return <div className="my-1 border-t border-border/60" />;
}

function DdItem({
  icon, label, sublabel, onClick, danger, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
        disabled
          ? "opacity-40 cursor-default"
          : danger
          ? "text-red-600 hover:bg-red-50"
          : "text-text hover:bg-surface2 cursor-pointer",
      )}
    >
      <span className={cn("shrink-0", danger ? "text-red-500" : "text-muted")}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm leading-snug">{label}</span>
        {sublabel && <span className="block text-[11px] text-muted leading-tight">{sublabel}</span>}
      </span>
    </button>
  );
}

function EntityActionsMenu({
  entity,
  isSupplier,
  onEdit,
  onAddContact,
  onAddAddress,
  onAddMerma,
  onAddRelation,
  onAttachFile,
  onViewBalance,
  onToggle,
  onDelete,
}: {
  entity: EntityDetailType;
  isSupplier: boolean;
  onEdit: () => void;
  onAddContact: () => void;
  onAddAddress: () => void;
  onAddMerma: () => void;
  onAddRelation: () => void;
  onAttachFile: () => void;
  onViewBalance: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  function run(fn: () => void) { setOpen(false); fn(); }

  const role = isSupplier ? "proveedor" : "cliente";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-card text-muted hover:bg-surface2 hover:text-text transition-colors"
        title="Más acciones"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-border bg-card shadow-lg z-50 py-1.5 overflow-hidden">
          {isSupplier ? (
            <>
              <DdItem icon={<ShoppingCart size={14} />} label="Nueva compra"             sublabel="Próximamente" disabled onClick={() => run(() => {})} />
              <DdItem icon={<Banknote     size={14} />} label="Registrar pago"           sublabel="Próximamente" disabled onClick={() => run(() => {})} />
              <DdItem icon={<BarChart2    size={14} />} label="Ver cuenta corriente"     onClick={() => run(onViewBalance)} />
              <DdItem icon={<FileText     size={14} />} label="Cargar factura proveedor" sublabel="Próximamente" disabled onClick={() => run(() => {})} />
            </>
          ) : (
            <>
              <DdItem icon={<ShoppingBag size={14} />} label="Nueva venta"          sublabel="Próximamente" disabled onClick={() => run(() => {})} />
              <DdItem icon={<Banknote    size={14} />} label="Registrar cobro"      sublabel="Próximamente" disabled onClick={() => run(() => {})} />
              <DdItem icon={<BarChart2   size={14} />} label="Ver cuenta corriente" onClick={() => run(onViewBalance)} />
              <DdItem icon={<FileText    size={14} />} label="Generar comprobante"  sublabel="Próximamente" disabled onClick={() => run(() => {})} />
            </>
          )}

          <DdSep />

          <DdItem icon={<UserPlus  size={14} />} label="Agregar contacto"   onClick={() => run(onAddContact)} />
          <DdItem icon={<MapPin    size={14} />} label="Agregar dirección"  onClick={() => run(onAddAddress)} />
          <DdItem icon={<Percent   size={14} />} label="Agregar merma"      onClick={() => run(onAddMerma)} />
          <DdItem icon={<Link2     size={14} />} label="Agregar relación"   onClick={() => run(onAddRelation)} />
          <DdItem icon={<Paperclip size={14} />} label="Adjuntar archivo"   onClick={() => run(onAttachFile)} />

          <DdSep />

          <DdItem icon={<Pencil size={14} />} label="Editar" onClick={() => run(onEdit)} />
          <DdItem
            icon={entity.isActive ? <PowerOff size={14} /> : <Power size={14} />}
            label={entity.isActive ? `Desactivar ${role}` : `Activar ${role}`}
            onClick={() => run(onToggle)}
          />
          <DdItem icon={<Trash2 size={14} />} label={`Eliminar ${role}`} danger onClick={() => run(onDelete)} />
        </div>
      )}
    </div>
  );
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

  const [addresses, setAddresses]               = useState<EntityAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

  const [contacts, setContacts]                 = useState<EntityContact[]>([]);
  const [contactsLoading, setContactsLoading]   = useState(false);

  const [attachments, setAttachments]           = useState<EntityAttachment[]>([]);


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
          balanceType: "UNIFIED",
          commercialApplyOn: "",
          commercialRuleType: "",
          commercialValueType: "",
          commercialValue: null,
          paymentTerm: "",
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
  const attachInputRef  = useRef<HTMLInputElement>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);

  // ---------------------------------------------------------------------------
  // Attachment upload / delete state (for inline section in General tab)
  // ---------------------------------------------------------------------------
  const [busyUploadAtt, setBusyUploadAtt]     = useState(false);
  const [deletingAttId, setDeletingAttId]     = useState<string | null>(null);
  const [deleteAttTarget, setDeleteAttTarget] = useState<string | null>(null);
  const [deleteAttOpen, setDeleteAttOpen]     = useState(false);

  // ---------------------------------------------------------------------------
  // Actions menu — triggers para modales de sub-secciones
  // ---------------------------------------------------------------------------
  const [addAddrTrigger, setAddAddrTrigger]         = useState(0);
  const [addContactTrigger, setAddContactTrigger]   = useState(0);
  const [addMermaTrigger, setAddMermaTrigger]       = useState(0);
  const [addRelationTrigger, setAddRelationTrigger] = useState(0);

  // Modal de edición (reutiliza EntityEditModal de la tabla)
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Observaciones inline
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesDraft, setNotesDraft]         = useState("");
  const [busyNotes, setBusyNotes]           = useState(false);

  // Toggle entidad activo/inactivo
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [busyToggle, setBusyToggle]               = useState(false);

  // Eliminar entidad
  const [confirmDeleteEntityOpen, setConfirmDeleteEntityOpen] = useState(false);
  const [busyDeleteEntity, setBusyDeleteEntity]               = useState(false);

  // ---------------------------------------------------------------------------
  // Catalogs
  // ---------------------------------------------------------------------------
  const docTypeCat     = useCatalog("DOCUMENT_TYPE");
  const ivaCat         = useCatalog("IVA_CONDITION");
  const prefixCat      = useCatalog("PHONE_PREFIX");
  const paymentTermCat = useCatalog("PAYMENT_TERM");

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
      setContacts(data.contacts);
      setAttachments(data.attachments);
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
  // Tab change
  // ---------------------------------------------------------------------------
  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
  }

  // ---------------------------------------------------------------------------
  // Attachment handlers (used in inline Adjuntos section in General tab)
  // ---------------------------------------------------------------------------
  async function handleUploadAttachments(files: File[]) {
    if (!entity) return;
    setBusyUploadAtt(true);
    try {
      for (const f of files) {
        await commercialEntitiesApi.attachments.upload(entity.id, f);
      }
      const updated = await commercialEntitiesApi.attachments.list(entity.id);
      setAttachments(updated);
      toast.success(files.length === 1 ? "Adjunto subido." : `${files.length} adjuntos subidos.`);
    } catch (e: any) {
      toast.error(e?.message || "Error al subir.");
    } finally {
      setBusyUploadAtt(false);
    }
  }

  async function handleDeleteAttachment() {
    if (!deleteAttTarget || !entity) return;
    setDeletingAttId(deleteAttTarget);
    try {
      await commercialEntitiesApi.attachments.remove(entity.id, deleteAttTarget);
      setAttachments((prev) => prev.filter((a) => a.id !== deleteAttTarget));
      setDeleteAttOpen(false);
      setDeleteAttTarget(null);
      toast.success("Adjunto eliminado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setDeletingAttId(null);
    }
  }

  async function handleSaveNotes() {
    if (!entity) return;
    setBusyNotes(true);
    try {
      const updated = await commercialEntitiesApi.update(entity.id, {
        ...draftToPayload(entityToDraft(entity), entity),
        notes: notesDraft.trim(),
      });
      setEntity((prev) => prev ? { ...prev, ...updated } : prev);
      setNotesModalOpen(false);
      toast.success("Observaciones guardadas.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusyNotes(false);
    }
  }

  async function handleToggle() {
    if (!entity) return;
    setBusyToggle(true);
    try {
      const updated = await commercialEntitiesApi.toggle(entity.id);
      setEntity((prev) => prev ? { ...prev, ...updated } : prev);
      setConfirmToggleOpen(false);
      toast.success(entity.isActive ? "Entidad desactivada." : "Entidad activada.");
    } catch (e: any) {
      toast.error(e?.message || "Error al cambiar estado.");
    } finally {
      setBusyToggle(false);
    }
  }

  async function handleDeleteEntity() {
    if (!entity) return;
    setBusyDeleteEntity(true);
    try {
      await commercialEntitiesApi.remove(entity.id);
      toast.success("Entidad eliminada.");
      navigate(backPath);
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDeleteEntity(false);
    }
  }

  async function reloadAddresses() {
    if (!entity) return;
    setAddressesLoading(true);
    try {
      setAddresses(await commercialEntitiesApi.addresses.list(entity.id));
    } catch (e: any) { toast.error(e?.message || "Error al cargar direcciones."); }
    finally { setAddressesLoading(false); }
  }

  async function reloadContacts() {
    if (!entity) return;
    setContactsLoading(true);
    try {
      setContacts(await commercialEntitiesApi.contacts.list(entity.id));
    } catch (e: any) { toast.error(e?.message || "Error al cargar contactos."); }
    finally { setContactsLoading(false); }
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

  // Derived identity display values (safe after loading guards above)
  const currentEntityType: EntityType = editing
    ? (draft?.entityType ?? "PERSON")
    : (entity?.entityType ?? "PERSON");
  const personIsPrimary  = currentEntityType === "PERSON";
  const companyIsPrimary = currentEntityType === "COMPANY";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>

      {/* ── Header ── */}
      <div className="border-b border-border bg-card px-4 md:px-8 pt-4 pb-0">
        <div className="w-full">

          {/* Fila principal: [avatar + identidad] | [acciones] */}
          <div className="flex items-start justify-between gap-4">

            {/* ── Izquierda: avatar + info ── */}
            <div className="flex items-start gap-4 min-w-0">

              {/* Avatar */}
              {!createMode && entity && (
                <div className="shrink-0 mt-0.5">
                  <TPAvatarUploader
                    src={entity.avatarUrl}
                    name={entity.displayName}
                    size={56}
                    rounded="full"
                    showActions={editing}
                    disabled={busyAvatar}
                    loading={busyAvatar}
                    onUpload={handleAvatarChange}
                    onError={(msg) => toast.error(msg)}
                  />
                </div>
              )}

              {/* Datos de identidad */}
              <div className="min-w-0 space-y-1.5 pt-0.5">
                {createMode ? (
                  <h1 className="text-2xl font-bold text-text leading-tight">
                    {isSupplierContext ? "Nuevo proveedor" : "Nuevo cliente"}
                  </h1>
                ) : (
                  <>
                    {/* Nombre + estado */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-2xl font-bold text-text leading-tight">
                        {entity!.displayName}
                      </h1>
                      <TPStatusPill active={entity!.isActive} />
                    </div>

                    {/* Badges de rol + tipo */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {entity!.isClient && (
                        <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          Cliente
                        </span>
                      )}
                      {entity!.isSupplier && (
                        <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          Proveedor
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-md border border-border/60 bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted">
                        {ENTITY_TYPE_LABELS[entity!.entityType]}
                      </span>
                    </div>

                    {/* Metadata rápida: teléfono · email · documento */}
                    {(entity!.phone || entity!.email || entity!.documentType || entity!.documentNumber) && (
                      <div className="flex items-center gap-3.5 flex-wrap">
                        {entity!.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Phone size={11} className="shrink-0 text-muted/60" />{entity!.phone}
                          </span>
                        )}
                        {entity!.email && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Mail size={11} className="shrink-0 text-muted/60" />{entity!.email}
                          </span>
                        )}
                        {(entity!.documentType || entity!.documentNumber) && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <FileText size={11} className="shrink-0 text-muted/60" />
                            {[entity!.documentType, entity!.documentNumber].filter(Boolean).join(": ")}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Derecha: acciones ── */}
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {editing ? (
                <>
                  <TPButton variant="secondary" onClick={cancelEdit} disabled={busySave} iconLeft={<X size={14} />}>
                    Cancelar
                  </TPButton>
                  <TPButton variant="primary" onClick={saveEdit} disabled={busySave} iconLeft={<Check size={14} />}>
                    {busySave ? "Guardando…" : createMode ? "Crear entidad" : "Guardar cambios"}
                  </TPButton>
                </>
              ) : (
                <>
                  <TPButton variant="secondary" onClick={() => navigate(-1)} iconLeft={<ArrowLeft size={14} />}>
                    Volver
                  </TPButton>
                  {!createMode && (
                    <TPButton variant="primary" onClick={() => setEditModalOpen(true)} iconLeft={<Pencil size={14} />}>
                      Editar
                    </TPButton>
                  )}
                  {!createMode && entity && (
                    <EntityActionsMenu
                      entity={entity}
                      isSupplier={isSupplierContext}
                      onEdit={() => setEditModalOpen(true)}
                      onAddContact={() => { setActiveTab("general"); setAddContactTrigger((n) => n + 1); }}
                      onAddAddress={() => { setActiveTab("general"); setAddAddrTrigger((n) => n + 1); }}
                      onAddMerma={() => { setActiveTab("general"); setAddMermaTrigger((n) => n + 1); }}
                      onAddRelation={() => { setActiveTab("general"); setAddRelationTrigger((n) => n + 1); }}
                      onAttachFile={() => { setActiveTab("general"); setTimeout(() => attachInputRef.current?.click(), 80); }}
                      onViewBalance={() => setActiveTab("balance")}
                      onToggle={() => setConfirmToggleOpen(true)}
                      onDelete={() => setConfirmDeleteEntityOpen(true)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tab nav — solo tabs, sin acciones */}
          <div className="flex gap-1 overflow-x-auto mt-3 pb-2">
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
      <div className="w-full px-4 md:px-8 py-4">

        {/* ── Tab: General ── */}
        {activeTab === "general" && !editing && !createMode && entity && (
          <div className="space-y-3">

            {/* ── Ficha principal: identidad + condiciones comerciales ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

              {/* Identidad — ocupa 2/3 */}
              <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                  <Building2 size={13} className="text-muted shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Identidad y contacto</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                  {entity.entityType === "COMPANY" ? (
                    <>
                      <FactPair label="Nombre de fantasía" value={entity.tradeName} />
                      <FactPair label="Razón social" value={entity.companyName} />
                      {(entity.firstName || entity.lastName) && (
                        <FactPair label="Contacto principal" value={[entity.firstName, entity.lastName].filter(Boolean).join(" ")} />
                      )}
                    </>
                  ) : (
                    <>
                      <FactPair label="Nombre" value={[entity.firstName, entity.lastName].filter(Boolean).join(" ")} />
                      {entity.tradeName && <FactPair label="Nombre de fantasía" value={entity.tradeName} />}
                      {entity.companyName && <FactPair label="Empresa" value={entity.companyName} />}
                    </>
                  )}
                  <FactPair label="Tipo de persona" value={ENTITY_TYPE_LABELS[entity.entityType]} />
                  {(entity.documentType || entity.documentNumber) && (
                    <FactPair label="Documento" value={[entity.documentType, entity.documentNumber].filter(Boolean).join(": ")} />
                  )}
                  {entity.ivaCondition && (
                    <FactPair label="Condición IVA" value={entity.ivaCondition} />
                  )}
                  {entity.phone && <FactPair label="Teléfono" value={entity.phone} />}
                  {entity.email && <FactPair label="Email" value={entity.email} />}
                </div>
              </div>

              {/* Condiciones comerciales — ocupa 1/3 */}
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                  <ReceiptIcon size={13} className="text-muted shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Condiciones comerciales</span>
                </div>
                <div className="space-y-2.5">
                  <FactPair
                    label="Lista de precios"
                    value={entity.priceListId
                      ? (priceLists.find((p) => p.id === entity.priceListId)?.name ?? "—")
                      : "Hereda del sistema"}
                  />
                  <FactPair
                    label="Moneda"
                    value={entity.currencyId
                      ? (() => { const c = currencies.find((x) => x.id === entity.currencyId); return c ? `${c.code} — ${c.name}` : "—"; })()
                      : "Moneda base"}
                  />
                  <FactPair
                    label="Tipo de saldo"
                    value={entity.balanceType === "UNIFIED" ? "Unificado" : "Desglosado"}
                  />
                  {entity.commercialApplyOn && (
                    <FactPair label="Base impuestos" value={COMMERCIAL_APPLY_ON_LABELS[entity.commercialApplyOn]} />
                  )}
                  {entity.commercialRuleType && (
                    <FactPair
                      label="Beneficio / Recargo"
                      value={entity.commercialRuleType === "BONUS" ? "Beneficio" : "Recargo"}
                    />
                  )}
                  {entity.commercialValue != null && (
                    <FactPair
                      label="Valor"
                      value={(() => {
                        const v = parseFloat(entity.commercialValue);
                        if (entity.commercialValueType === "PERCENTAGE") return `${v}%`;
                        if (entity.commercialValueType === "FIXED_AMOUNT") {
                          const sym = currencies.find((c) => c.id === entity.currencyId)?.symbol ?? currencies.find((c) => c.isBase)?.symbol ?? "$";
                          return `${sym} ${v}`;
                        }
                        return String(v);
                      })()}
                    />
                  )}
                  {entity.paymentTerm && (
                    <FactPair label="Término de pago" value={entity.paymentTerm} />
                  )}
                </div>
              </div>

            </div>

            {/* ── Card contenedor: Gestión de la entidad ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">

              {/* Header del contenedor */}
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <Tag size={13} className="text-muted shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Gestión de la entidad</span>
              </div>

              {/* Grid 2 columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* Domicilios */}
                <EntitySectionCard
                  icon={<MapPin size={13} />}
                  title="Domicilios"
                  count={addresses.length}
                  onAdd={entity.isActive ? () => setAddAddrTrigger((n) => n + 1) : undefined}
                >
                  <TabAddresses entityId={entity.id} data={addresses} contacts={contacts} entityName={entity.displayName} loading={addressesLoading} onReload={reloadAddresses} openAddTrigger={addAddrTrigger} hideHeader />
                </EntitySectionCard>

                {/* Contactos */}
                <EntitySectionCard
                  icon={<Users size={13} />}
                  title="Contactos"
                  count={contacts.length}
                  onAdd={entity.isActive ? () => setAddContactTrigger((n) => n + 1) : undefined}
                >
                  <TabContacts entityId={entity.id} data={contacts} loading={contactsLoading} onReload={reloadContacts} openAddTrigger={addContactTrigger} hideHeader />
                </EntitySectionCard>

                {/* Merma por variante */}
                <EntitySectionCard
                  icon={<Percent size={13} />}
                  title="Merma por variante"
                  onAdd={entity.isActive ? () => setAddMermaTrigger((n) => n + 1) : undefined}
                >
                  <TabMerma entityId={entity.id} isClient={entity.isClient} isSupplier={entity.isSupplier} hasRelations={entity.hasRelations} disabled={!entity.isActive} openAddTrigger={addMermaTrigger} hideHeader />
                </EntitySectionCard>

                {/* Relaciones */}
                <EntitySectionCard
                  icon={<Link2 size={13} />}
                  title="Relaciones"
                  onAdd={entity.isActive ? () => setAddRelationTrigger((n) => n + 1) : undefined}
                >
                  <TabRelations entityId={entity.id} isClient={entity.isClient} isSupplier={entity.isSupplier} disabled={!entity.isActive} openAddTrigger={addRelationTrigger} hideTitle />
                </EntitySectionCard>

                {/* Observaciones */}
                <EntitySectionCard
                  icon={<StickyNote size={13} />}
                  title="Observaciones"
                  onAdd={() => { setNotesDraft(entity.notes ?? ""); setNotesModalOpen(true); }}
                >
                  {entity.notes
                    ? <p className="text-sm text-text whitespace-pre-wrap">{entity.notes}</p>
                    : <p className="text-xs text-muted/50 italic">Sin observaciones.</p>
                  }
                </EntitySectionCard>

                {/* Adjuntos */}
                <EntitySectionCard
                  icon={<Paperclip size={13} />}
                  title="Adjuntos"
                  count={attachments.length}
                  onAdd={() => attachInputRef.current?.click()}
                  busyAdd={busyUploadAtt}
                >
                  <input ref={attachInputRef} type="file" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) void handleUploadAttachments(files); e.target.value = ""; }} />
                  <TPAttachmentList
                    items={attachments.map((a) => ({ id: a.id, name: a.filename, size: a.size, url: a.url || undefined, mimeType: a.mimeType }))}
                    loading={busyUploadAtt}
                    deletingId={deletingAttId}
                    emptyText="Todavía no hay adjuntos."
                    onDownload={(it) => { if (it.url) window.location.assign(it.url); }}
                    onView={(it) => { if (it.url) window.open(it.url, "_blank", "noreferrer"); }}
                    onDelete={(it) => { setDeleteAttTarget(it.id); setDeleteAttOpen(true); }}
                  />
                  <ConfirmDeleteDialog
                    open={deleteAttOpen}
                    title="Eliminar adjunto"
                    description="¿Estás seguro? Esta acción no se puede deshacer."
                    confirmText="Eliminar"
                    busy={deletingAttId !== null}
                    onClose={() => { if (!deletingAttId) { setDeleteAttOpen(false); setDeleteAttTarget(null); } }}
                    onConfirm={handleDeleteAttachment}
                  />
                </EntitySectionCard>

              </div>
            </div>

          </div>
        )}

        {/* ── Tab: General (modo edición / creación) ── */}
        {activeTab === "general" && (editing || createMode) && (
          /* ════════════════════════════════════════
             MODO EDICIÓN — formulario completo
             ════════════════════════════════════════ */
          <div className="space-y-4">

            {/* ── Datos principales ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <SectionHead title="Datos principales" micro="Identificación de la entidad" />
              </div>

              {/* Tipo de entidad + roles */}
              <div className="flex flex-wrap items-center gap-4">
                {!isRoleFixed && (
                  <>
                    <TPCheckbox
                      checked={draft!.isClient}
                      onChange={(v) => set("isClient", v)}
                      disabled={busySave}
                      label={<span className="text-sm">Es cliente</span>}
                    />
                    <TPCheckbox
                      checked={draft!.isSupplier}
                      onChange={(v) => set("isSupplier", v)}
                      disabled={busySave}
                      label={<span className="text-sm">Es proveedor</span>}
                    />
                    <div className="h-4 w-px bg-border/60" />
                  </>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Tipo:</span>
                  <TPSelect
                    value={draft!.entityType}
                    onChange={(v) => set("entityType", v as EntityType)}
                    disabled={busySave}
                    options={[
                      { value: "PERSON",  label: "Persona física" },
                      { value: "COMPANY", label: "Empresa" },
                    ]}
                  />
                </div>
                {submitted && draft && !draft.isClient && !draft.isSupplier && (
                  <span className="text-xs text-red-500">Debe ser cliente, proveedor o ambos.</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TPField
                  label={currentEntityType === "COMPANY" ? "Nombre de fantasía *" : "Nombre de fantasía"}
                  error={submitted && currentEntityType === "COMPANY" && draft && !draft.tradeName.trim() ? "El nombre de fantasía es obligatorio." : null}
                >
                  <TPInput value={draft!.tradeName} onChange={(v) => set("tradeName", v)} disabled={busySave} placeholder="Joyas del Sur" />
                </TPField>
                <TPField label="Razón social">
                  <TPInput value={draft!.companyName} onChange={(v) => set("companyName", v)} disabled={busySave} placeholder="Joyería del Sur SA" />
                </TPField>
                <TPField
                  label={currentEntityType === "PERSON" ? "Nombre *" : "Nombre del contacto"}
                  error={submitted && currentEntityType === "PERSON" && draft && !draft.firstName.trim() ? "El nombre es obligatorio." : null}
                >
                  <TPInput value={draft!.firstName} onChange={(v) => set("firstName", v)} disabled={busySave} placeholder="Juan" />
                </TPField>
                <TPField
                  label={currentEntityType === "PERSON" ? "Apellido *" : "Apellido del contacto"}
                  error={submitted && currentEntityType === "PERSON" && draft && !draft.lastName.trim() ? "El apellido es obligatorio." : null}
                >
                  <TPInput value={draft!.lastName} onChange={(v) => set("lastName", v)} disabled={busySave} placeholder="García" />
                </TPField>
              </div>
            </div>

            {/* ── Datos fiscales ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <SectionHead title="Datos fiscales" micro="Documento y condición impositiva" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TPField label="Tipo de documento">
                  <TPComboCreatable
                    type="DOCUMENT_TYPE"
                    items={docTypeCat.items}
                    loading={docTypeCat.loading}
                    value={draft!.documentType}
                    onChange={(v) => set("documentType", v)}
                    placeholder="DNI / CUIT"
                    disabled={busySave}
                    allowCreate
                    onRefresh={() => void docTypeCat.refresh()}
                    onCreate={async (label) => { await docTypeCat.createItem(label); set("documentType", label); }}
                    mode="edit"
                  />
                </TPField>
                <TPField label="Número de documento">
                  <TPInput value={draft!.documentNumber} onChange={(v) => set("documentNumber", v)} disabled={busySave} placeholder="20-12345678-9" />
                </TPField>
                <TPField label="Condición IVA">
                  <TPComboCreatable
                    type="IVA_CONDITION"
                    items={ivaCat.items}
                    loading={ivaCat.loading}
                    value={draft!.ivaCondition}
                    onChange={(v) => set("ivaCondition", v)}
                    placeholder="Resp. Inscripto…"
                    disabled={busySave}
                    allowCreate
                    onRefresh={() => void ivaCat.refresh()}
                    onCreate={async (label) => { await ivaCat.createItem(label); set("ivaCondition", label); }}
                    mode="edit"
                  />
                </TPField>
              </div>
            </div>

            {/* ── Contacto ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <SectionHead title="Contacto" micro="Correo y teléfono principal" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TPField label="Email">
                  <TPInput type="email" value={draft!.email} onChange={(v) => set("email", v)} disabled={busySave} placeholder="contacto@empresa.com" />
                </TPField>
                <TPField label="Teléfono">
                  <div className="flex gap-2">
                    <div className="w-32 shrink-0">
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
                    </div>
                    <div className="flex-1">
                      <TPInput value={draft!.phoneNumber} onChange={(v) => set("phoneNumber", v)} disabled={busySave} placeholder="11 1234 5678" />
                    </div>
                  </div>
                </TPField>
              </div>
            </div>

            {/* ── Comercial ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <SectionHead title="Comercial" micro="Lista de precios, moneda y condiciones por defecto" />
              <div className="space-y-3">
                <TPField label="Lista de precios" hint="Si no se asigna, se usa la lista favorita o general del sistema.">
                  <TPComboFixed
                    value={draft!.priceListId ?? ""}
                    onChange={(v) => set("priceListId", v || null)}
                    disabled={busySave}
                    searchable
                    searchPlaceholder="Buscar lista…"
                    options={[
                      { value: "", label: "— Heredar del sistema —" },
                      ...priceLists.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </TPField>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <TPField label="Moneda" hint="Si no se asigna, se usa la moneda base del sistema.">
                    <TPComboFixed
                      value={draft!.currencyId ?? ""}
                      onChange={(v) => set("currencyId", v || null)}
                      disabled={busySave}
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
                      value={draft!.balanceType}
                      onChange={(v) => set("balanceType", v as BalanceType)}
                      disabled={busySave}
                      options={[
                        { value: "UNIFIED",   label: "Unificado" },
                        { value: "BREAKDOWN", label: "Desglosado" },
                      ]}
                    />
                  </TPField>
                  <TPField label="Base de impuestos">
                    <TPComboFixed
                      value={draft!.commercialApplyOn}
                      onChange={(v) => set("commercialApplyOn", v as CommercialApplyOn | "")}
                      disabled={busySave}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <TPField label="Tipo de beneficio o recargo">
                    <TPComboFixed
                      value={draft!.commercialRuleType}
                      onChange={(v) => set("commercialRuleType", v as CommercialRuleType | "")}
                      disabled={busySave}
                      options={[
                        { value: "",          label: "— Sin especificar —" },
                        { value: "BONUS",     label: "Beneficio" },
                        { value: "SURCHARGE", label: "Recargo" },
                      ]}
                    />
                  </TPField>
                  <TPField label="Tipo de valor">
                    <TPComboFixed
                      value={draft!.commercialValueType}
                      onChange={(v) => set("commercialValueType", v as CommercialValueType | "")}
                      disabled={busySave}
                      options={[
                        { value: "",             label: "— Sin especificar —" },
                        { value: "PERCENTAGE",   label: "Porcentaje (%)" },
                        { value: "FIXED_AMOUNT", label: "Monto fijo ($)" },
                      ]}
                    />
                  </TPField>
                  <TPField label="Valor">
                    <TPNumberInput
                      value={draft!.commercialValue}
                      onChange={(v) => set("commercialValue", v)}
                      disabled={busySave}
                      min={0}
                      placeholder="0"
                      suffix={draft!.commercialValueType === "PERCENTAGE" ? "%" : undefined}
                      leftIcon={draft!.commercialValueType === "FIXED_AMOUNT" ? <span className="text-xs font-medium">{currencies.find((c) => c.id === draft!.currencyId)?.symbol ?? currencies.find((c) => c.isBase)?.symbol ?? "$"}</span> : undefined}
                    />
                  </TPField>
                </div>
                <TPField label="Término de pago" hint="Condición de pago habitual para esta entidad.">
                  <TPComboCreatable
                    type="PAYMENT_TERM"
                    items={paymentTermCat.items}
                    loading={paymentTermCat.loading}
                    value={draft!.paymentTerm}
                    onChange={(v) => set("paymentTerm", v)}
                    placeholder="Contado, 30 días…"
                    disabled={busySave}
                    allowCreate
                    onRefresh={() => void paymentTermCat.refresh()}
                    onCreate={async (label) => { await paymentTermCat.createItem(label); set("paymentTerm", label); }}
                    mode="edit"
                  />
                </TPField>
              </div>
            </div>

            {/* ── Observaciones ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <SectionHead title="Observaciones" micro="Notas internas visibles solo para el equipo" />
              <TPTextarea
                value={draft!.notes}
                onChange={(v) => set("notes", v)}
                disabled={busySave}
                minH={80}
                placeholder="Notas internas sobre esta entidad…"
              />
            </div>

            {/* ── Ubicaciones (solo edición, no creación) ── */}
            {!createMode && entity && (
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <SectionHead title="Ubicaciones" micro="Domicilios registrados" />
                </div>
                <TabAddresses
                  entityId={entity.id}
                  data={addresses}
                  contacts={contacts}
                  entityName={entity.displayName}
                  loading={addressesLoading}
                  onReload={reloadAddresses}
                />
              </div>
            )}

            {/* ── Contactos adicionales (solo edición, no creación) ── */}
            {!createMode && entity && (
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <SectionHead title="Contactos adicionales" micro="Personas de contacto en la organización" />
                </div>
                <TabContacts
                  entityId={entity.id}
                  data={contacts}
                  loading={contactsLoading}
                  onReload={reloadContacts}
                />
              </div>
            )}

            {/* ── Adjuntos ── */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <SectionHead title="Adjuntos" micro="Documentos y archivos adjuntos" />
              {createMode ? (
                <>
                  <TPDropzone
                    multiple
                    disabled={busySave}
                    title="Click para agregar archivos +"
                    subtitle="Se subirán al guardar la entidad"
                    onFiles={(files) => setStagedFiles((prev) => [...prev, ...files])}
                  />
                  <TPAttachmentList
                    items={stagedFiles.map((f, i) => ({ id: `staged-${i}`, name: f.name, mimeType: f.type }))}
                    onDelete={(it) => {
                      const idx = parseInt(it.id.replace("staged-", ""), 10);
                      setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    emptyText=""
                  />
                </>
              ) : (
                <>
                  <TPDropzone
                    multiple
                    disabled={busyUploadAtt}
                    loading={busyUploadAtt}
                    title="Click para agregar archivos +"
                    subtitle="También podés arrastrar y soltar acá"
                    onFiles={handleUploadAttachments}
                  />
                  <TPAttachmentList
                    items={attachments.map((a) => ({
                      id: a.id,
                      name: a.filename,
                      size: a.size,
                      url: a.url || undefined,
                      mimeType: a.mimeType,
                    }))}
                    loading={busyUploadAtt}
                    deletingId={deletingAttId}
                    onView={(it) => it.url && window.open(it.url, "_blank", "noreferrer")}
                    onDownload={(it) => it.url && window.location.assign(it.url)}
                    onDelete={(it) => { setDeleteAttTarget(it.id); setDeleteAttOpen(true); }}
                    emptyText="Todavía no hay adjuntos."
                  />
                  <ConfirmDeleteDialog
                    open={deleteAttOpen}
                    title="Eliminar adjunto"
                    description="¿Estás seguro? Esta acción no se puede deshacer."
                    confirmText="Eliminar"
                    busy={deletingAttId !== null}
                    onClose={() => { if (!deletingAttId) { setDeleteAttOpen(false); setDeleteAttTarget(null); } }}
                    onConfirm={handleDeleteAttachment}
                  />
                </>
              )}
            </div>

          </div>
        )}

        {/* ── Tab: Transacciones ── */}
        {activeTab === "transactions" && (
          <div className="rounded-xl border border-border/50 bg-card p-8 text-center space-y-2">
            <div className="text-sm font-medium text-text">Transacciones</div>
            <div className="text-xs text-muted">Las facturas, remitos y comprobantes estarán disponibles cuando se implemente el módulo de Comprobantes.</div>
          </div>
        )}

        {/* ── Tab: Estado de cuenta ── */}
        {activeTab === "balance" && entity && (
          <TabBalance
            entity={entity}
            onUpdate={(updated) => setEntity(updated)}
          />
        )}

      </div>

      {/* ── Modal edición de entidad ── */}
      {!createMode && entity && (
        <EntityEditModal
          open={editModalOpen}
          mode="EDIT"
          entityId={entity.id}
          isClientContext={isClientContext}
          isSupplierContext={isSupplierContext}
          onClose={() => setEditModalOpen(false)}
          onSaved={async () => { setEditModalOpen(false); await fetchEntity(); }}
        />
      )}

      {/* ── Modal observaciones ── */}
      <Modal
        open={notesModalOpen}
        title="Observaciones"
        subtitle="Notas internas visibles solo para el equipo."
        maxWidth="md"
        busy={busyNotes}
        onClose={() => setNotesModalOpen(false)}
        onEnter={handleSaveNotes}
        footer={
          <>
            <TPButton variant="secondary" onClick={() => setNotesModalOpen(false)} disabled={busyNotes} iconLeft={<X size={14} />}>Cancelar</TPButton>
            <TPButton variant="primary" onClick={handleSaveNotes} loading={busyNotes} iconLeft={<Check size={14} />}>Guardar</TPButton>
          </>
        }
      >
        <TPTextarea
          value={notesDraft}
          onChange={setNotesDraft}
          disabled={busyNotes}
          minH={120}
          placeholder="Notas internas sobre esta entidad…"
        />
      </Modal>

      {/* ── Dialogs globales (toggle y delete entidad) ── */}
      <ConfirmDeleteDialog
        open={confirmToggleOpen}
        title={entity?.isActive ? "Desactivar entidad" : "Activar entidad"}
        description={
          entity?.isActive
            ? "La entidad quedará inactiva y no aparecerá en búsquedas por defecto. Podés reactivarla en cualquier momento."
            : "La entidad volverá a estar activa y aparecerá en búsquedas."
        }
        confirmText={entity?.isActive ? "Desactivar" : "Activar"}
        busy={busyToggle}
        onClose={() => { if (!busyToggle) setConfirmToggleOpen(false); }}
        onConfirm={handleToggle}
      />
      <ConfirmDeleteDialog
        open={confirmDeleteEntityOpen}
        title={`Eliminar ${isSupplierContext ? "proveedor" : "cliente"}`}
        description="Esta acción no se puede deshacer. Se eliminará la entidad y todos sus datos asociados."
        confirmText="Eliminar"
        busy={busyDeleteEntity}
        onClose={() => { if (!busyDeleteEntity) setConfirmDeleteEntityOpen(false); }}
        onConfirm={handleDeleteEntity}
      />
    </div>
  );
}
