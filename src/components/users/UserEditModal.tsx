import React, { type FormEvent } from "react";
import { Loader2, Paperclip, KeyRound, ShieldOff } from "lucide-react";

import { TPSegmentedPills } from "../ui/TPBadges";
import {
  cn,
  Modal,
  Section,
  Tabs,
  type TabKey,
  initialsFrom,
  formatBytes,
  safeFileLabel,
  absUrl,
  effectLabel,
  permLabelByModuleAction,
} from "./users.ui";

import type { Override, OverrideEffect, UserAttachment, UserDetail, Role } from "../../services/users";
import type { Permission } from "../../services/permissions";

type Props = {
  open: boolean;
  wide?: boolean;
  modalMode: "CREATE" | "EDIT";
  modalBusy: boolean;
  modalLoading: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (e?: FormEvent) => Promise<void> | void;

  // permissions
  canAdmin: boolean;

  // detail/state
  detail: UserDetail | null;

  tab: TabKey;
  setTab: (v: TabKey) => void;

  // fields + setters
  fEmail: string;
  setFEmail: (v: string) => void;
  fName: string;
  setFName: (v: string) => void;
  fPassword: string;
  setFPassword: (v: string) => void;

  fPhoneCountry: string;
  setFPhoneCountry: (v: string) => void;
  fPhoneNumber: string;
  setFPhoneNumber: (v: string) => void;
  fDocType: string;
  setFDocType: (v: string) => void;
  fDocNumber: string;
  setFDocNumber: (v: string) => void;

  fStreet: string;
  setFStreet: (v: string) => void;
  fNumber: string;
  setFNumber: (v: string) => void;
  fCity: string;
  setFCity: (v: string) => void;
  fProvince: string;
  setFProvince: (v: string) => void;
  fPostalCode: string;
  setFPostalCode: (v: string) => void;
  fCountry: string;
  setFCountry: (v: string) => void;

  fNotes: string;
  setFNotes: (v: string) => void;

  // avatar
  avatarBusy: boolean;
  avatarImgLoading: boolean;
  setAvatarImgLoading: (v: boolean) => void;
  avatarPreview: string;
  setAvatarPreview: (v: string | ((prev: string) => string)) => void;
  avatarInputModalRef: React.RefObject<HTMLInputElement>;
  pickAvatarForModal: (file: File) => Promise<void>;
  modalRemoveAvatar: () => Promise<void>;
  setAvatarFileDraft: (f: File | null) => void;

  // attachments
  attInputRef: React.RefObject<HTMLInputElement>;
  uploadingAttachments: boolean;
  deletingAttId: string | null;
  attachmentsDraft: File[];
  removeDraftAttachmentByIndex: (idx: number) => void;
  addAttachments: (files: File[]) => Promise<void>;
  removeSavedAttachment: (id: string) => Promise<void>;
  savedAttachments: UserAttachment[];

  // pin
  pinBusy: boolean;
  pinMsg: string | null;
  pinNew: string;
  setPinNew: (v: string) => void;
  pinNew2: string;
  setPinNew2: (v: string) => void;
  adminTogglePinEnabled: (next: boolean) => Promise<void>;
  adminSetOrResetPin: () => Promise<void>;
  adminRemovePin: () => Promise<void>;

  // warehouse
  fFavWarehouseId: string;
  setFFavWarehouseId: (v: string) => void;
  activeAlmacenes: Array<{ id: string; nombre: string; codigo: string }>;
  warehouseLabelById: (id?: string | null) => string | null;

  // roles
  roles: Role[];
  rolesLoading: boolean;
  fRoleIds: string[];
  setFRoleIds: (fn: (prev: string[]) => string[]) => void;
  roleLabel: (r: any) => string;

  // special perms
  allPerms: Permission[];
  permsLoading: boolean;

  specialEnabled: boolean;
  setSpecialEnabled: (v: boolean) => void;

  specialPermPick: string;
  setSpecialPermPick: (v: string) => void;

  specialEffectPick: OverrideEffect;
  setSpecialEffectPick: (v: OverrideEffect) => void;

  specialSaving: boolean;
  specialListSorted: Override[];
  addOrUpdateSpecial: () => Promise<void>;
  removeSpecial: (permissionId: string) => Promise<void>;
};

export default function UserEditModal(props: Props) {
  const {
    open,
    wide,
    modalMode,
    modalBusy,
    modalLoading,
    title,
    onClose,
    onSubmit,

    canAdmin,
    detail,

    tab,
    setTab,

    fEmail,
    setFEmail,
    fName,
    setFName,
    fPassword,
    setFPassword,

    fPhoneCountry,
    setFPhoneCountry,
    fPhoneNumber,
    setFPhoneNumber,
    fDocType,
    setFDocType,
    fDocNumber,
    setFDocNumber,

    fStreet,
    setFStreet,
    fNumber,
    setFNumber,
    fCity,
    setFCity,
    fProvince,
    setFProvince,
    fPostalCode,
    setFPostalCode,
    fCountry,
    setFCountry,

    fNotes,
    setFNotes,

    avatarBusy,
    avatarImgLoading,
    setAvatarImgLoading,
    avatarPreview,
    setAvatarPreview,
    avatarInputModalRef,
    pickAvatarForModal,
    modalRemoveAvatar,
    setAvatarFileDraft,

    attInputRef,
    uploadingAttachments,
    deletingAttId,
    attachmentsDraft,
    removeDraftAttachmentByIndex,
    addAttachments,
    removeSavedAttachment,
    savedAttachments,

    pinBusy,
    pinMsg,
    pinNew,
    setPinNew,
    pinNew2,
    setPinNew2,
    adminTogglePinEnabled,
    adminSetOrResetPin,
    adminRemovePin,

    fFavWarehouseId,
    setFFavWarehouseId,
    activeAlmacenes,
    warehouseLabelById,

    roles,
    rolesLoading,
    fRoleIds,
    setFRoleIds,
    roleLabel,

    allPerms,
    permsLoading,

    specialEnabled,
    setSpecialEnabled,
    specialPermPick,
    setSpecialPermPick,
    specialEffectPick,
    setSpecialEffectPick,

    specialSaving,
    specialListSorted,
    addOrUpdateSpecial,
    removeSpecial,
  } = props;

  return (
    <Modal open={open} wide={wide} title={title} onClose={onClose}>
      {modalLoading ? (
        <div className="tp-card p-4 text-sm text-muted flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Avatar (estilo Empresa) */}
          <div className="tp-card p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <button
                    type="button"
                    className={cn(
                      "h-16 w-16 rounded-2xl grid place-items-center relative overflow-hidden",
                      "focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]",
                      (avatarBusy || modalBusy) && "opacity-60 cursor-not-allowed"
                    )}
                    style={{
                      border: "1px solid var(--border)",
                      background: "color-mix(in oklab, var(--card) 80%, var(--bg))",
                      color: "var(--muted)",
                    }}
                    title={detail?.avatarUrl || avatarPreview ? "Editar avatar" : "Agregar avatar"}
                    onClick={() => {
                      if (!avatarBusy && !modalBusy) avatarInputModalRef.current?.click();
                    }}
                    disabled={avatarBusy || modalBusy}
                  >
                    {(avatarBusy || avatarImgLoading) && (
                      <div
                        className="absolute inset-0 grid place-items-center"
                        style={{ background: "rgba(0,0,0,0.22)" }}
                      >
                        <div className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      </div>
                    )}

                    {avatarPreview || detail?.avatarUrl ? (
                      <img
                        src={avatarPreview || detail?.avatarUrl!}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        onLoadStart={() => setAvatarImgLoading(true)}
                        onLoad={() => setAvatarImgLoading(false)}
                        onError={() => setAvatarImgLoading(false)}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                        {initialsFrom(fName || fEmail || "U")}
                      </div>
                    )}

                    <div
                      className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
                        "grid place-items-center"
                      )}
                      style={{ background: "rgba(0,0,0,0.28)" }}
                      aria-hidden="true"
                    >
                      <span className="text-white text-[11px] px-2 text-center leading-tight">
                        {avatarBusy ? "SUBIENDO…" : avatarPreview || detail?.avatarUrl ? "EDITAR" : "AGREGAR"}
                      </span>
                    </div>
                  </button>

                  {(avatarPreview || (modalMode === "EDIT" && detail?.avatarUrl)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (avatarBusy || modalBusy) return;

                        if (avatarPreview) {
                          setAvatarPreview((prev) => {
                            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                            return "";
                          });
                          setAvatarFileDraft(null);
                          return;
                        }

                        if (modalMode === "EDIT" && detail?.avatarUrl) void modalRemoveAvatar();
                      }}
                      className={cn(
                        "absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                      style={{
                        background: "rgba(255,255,255,0.75)",
                        border: "1px solid rgba(0,0,0,0.08)",
                        backdropFilter: "blur(6px)",
                      }}
                      title={avatarPreview ? "Descartar" : "Eliminar avatar"}
                      aria-label={avatarPreview ? "Descartar" : "Eliminar avatar"}
                      disabled={avatarBusy || modalBusy}
                    >
                      <span className="text-[11px] leading-none">✕</span>
                    </button>
                  )}

                  <input
                    ref={avatarInputModalRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (f) void pickAvatarForModal(f);
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold">Avatar</div>
                  <div className="text-xs text-muted">
                    {modalMode === "CREATE"
                      ? "Podés elegirlo ahora (se sube al crear)."
                      : "Elegí uno nuevo para actualizar al instante."}
                  </div>
                </div>
              </div>

              {avatarPreview && (
                <button
                  className="tp-btn"
                  type="button"
                  onClick={() => {
                    setAvatarPreview((prev) => {
                      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                      return "";
                    });
                    setAvatarFileDraft(null);
                  }}
                  disabled={avatarBusy || modalBusy}
                >
                  Descartar
                </button>
              )}
            </div>
          </div>

          <Tabs value={tab} onChange={setTab} />

          {/* TAB DATA */}
          {tab === "DATA" ? (
            <div className="space-y-4">
              <Section title="Cuenta" desc="Email y contraseña inicial.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-muted">Email</label>
                    <input
                      className="tp-input"
                      value={fEmail}
                      onChange={(e) => setFEmail(e.target.value)}
                      placeholder="usuario@correo.com"
                      disabled={modalMode === "EDIT"}
                    />
                    {modalMode === "EDIT" ? (
                      <p className="mt-1 text-[11px] text-muted">(El email no se edita desde aquí)</p>
                    ) : null}
                  </div>

                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-muted">Contraseña (opcional)</label>
                    <input
                      className="tp-input"
                      type="password"
                      value={fPassword}
                      onChange={(e) => setFPassword(e.target.value)}
                      placeholder={
                        modalMode === "CREATE"
                          ? "Si la dejás vacía, queda Inactivo"
                          : "Dejar vacía para no cambiar"
                      }
                    />
                    {modalMode === "CREATE" ? (
                      <p className="mt-1 text-[11px] text-muted">
                        Si la contraseña está vacía, el usuario queda <b>Inactivo</b> (PENDING en backend).
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted">(Solo se cambia si escribís una nueva)</p>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Datos personales" desc="Nombre, documento y dirección (como Empresa).">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-12">
                    <label className="mb-1 block text-xs text-muted">Nombre y apellido *</label>
                    <input
                      className="tp-input"
                      value={fName}
                      onChange={(e) => setFName(e.target.value)}
                      placeholder="Nombre Apellido"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-muted">Tipo doc.</label>
                    <input
                      className="tp-input"
                      value={fDocType}
                      onChange={(e) => setFDocType(e.target.value)}
                      placeholder="DNI / PAS / CUIT"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs text-muted">Nro. doc.</label>
                    <input
                      className="tp-input"
                      value={fDocNumber}
                      onChange={(e) => setFDocNumber(e.target.value)}
                      placeholder="12345678"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-muted">Tel. país</label>
                    <input
                      className="tp-input"
                      value={fPhoneCountry}
                      onChange={(e) => setFPhoneCountry(e.target.value)}
                      placeholder="+54"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs text-muted">Teléfono</label>
                    <input
                      className="tp-input"
                      value={fPhoneNumber}
                      onChange={(e) => setFPhoneNumber(e.target.value)}
                      placeholder="11 1234 5678"
                    />
                  </div>

                  <div className="md:col-span-12 mt-2">
                    <div className="tp-card p-4">
                      <div className="text-sm font-semibold mb-3">Domicilio</div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-5">
                          <label className="mb-1 block text-xs text-muted">Calle</label>
                          <input
                            className="tp-input"
                            value={fStreet}
                            onChange={(e) => setFStreet(e.target.value)}
                            placeholder="Calle"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs text-muted">Número</label>
                          <input
                            className="tp-input"
                            value={fNumber}
                            onChange={(e) => setFNumber(e.target.value)}
                            placeholder="123"
                          />
                        </div>

                        <div className="md:col-span-5">
                          <label className="mb-1 block text-xs text-muted">Ciudad</label>
                          <input
                            className="tp-input"
                            value={fCity}
                            onChange={(e) => setFCity(e.target.value)}
                            placeholder="Ciudad"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <label className="mb-1 block text-xs text-muted">Provincia</label>
                          <input
                            className="tp-input"
                            value={fProvince}
                            onChange={(e) => setFProvince(e.target.value)}
                            placeholder="Provincia"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <label className="mb-1 block text-xs text-muted">Código postal</label>
                          <input
                            className="tp-input"
                            value={fPostalCode}
                            onChange={(e) => setFPostalCode(e.target.value)}
                            placeholder="1012"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <label className="mb-1 block text-xs text-muted">País</label>
                          <input
                            className="tp-input"
                            value={fCountry}
                            onChange={(e) => setFCountry(e.target.value)}
                            placeholder="Argentina"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {attachmentsDraft.length > 0 && (
                <Section title="Adjuntos seleccionados" desc="Se subirán al guardar (o al crear).">
                  <div className="space-y-2">
                    {attachmentsDraft.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 border border-border bg-bg"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            {safeFileLabel(f.name)}
                          </div>
                          <div className="text-xs text-muted">{formatBytes(f.size)}</div>
                        </div>

                        <button
                          type="button"
                          className="tp-btn"
                          onClick={() => removeDraftAttachmentByIndex(idx)}
                          disabled={modalBusy || uploadingAttachments}
                          title="Quitar del borrador"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Notas" desc="Notas internas.">
                  <textarea
                    className="tp-input min-h-[180px]"
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                    placeholder="Notas internas…"
                  />
                </Section>

                <Section title="Adjuntos" desc="Archivos del usuario (PDF, imágenes, etc.).">
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="block w-full cursor-pointer"
                      onClick={() => attInputRef.current?.click()}
                      disabled={uploadingAttachments || modalBusy}
                    >
                      <div
                        className="min-h-[180px] flex items-center justify-center border border-dashed rounded-2xl"
                        style={{
                          borderColor: "var(--border)",
                          background: "color-mix(in oklab, var(--card) 82%, var(--bg))",
                          color: "var(--muted)",
                        }}
                      >
                        {uploadingAttachments ? "Subiendo…" : "Click para agregar archivos +"}
                      </div>
                    </button>

                    <input
                      ref={attInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        const picked = Array.from(e.currentTarget.files ?? []);
                        e.currentTarget.value = "";
                        void addAttachments(picked);
                      }}
                    />

                    {modalMode === "EDIT" && savedAttachments.length > 0 && (
                      <div>
                        <div className="text-xs text-[color:var(--muted)] mb-2">Guardados</div>
                        <div className="space-y-2">
                          {savedAttachments.map((a) => {
                            const busy = deletingAttId === a.id;
                            const url = absUrl(a.url || "");
                            const isImg = String(a.mimeType || "").startsWith("image/");

                            return (
                              <div
                                key={a.id}
                                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                                style={{
                                  border: "1px solid var(--border)",
                                  background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                                }}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {isImg && url ? (
                                    <img
                                      src={url}
                                      alt={safeFileLabel(a.filename)}
                                      className="h-10 w-10 rounded-lg object-cover border"
                                      style={{ borderColor: "var(--border)" }}
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div
                                      className="h-10 w-10 rounded-lg grid place-items-center border text-xs"
                                      style={{
                                        borderColor: "var(--border)",
                                        color: "var(--muted)",
                                        background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                                      }}
                                    >
                                      DOC
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <div className="text-sm text-text truncate">{safeFileLabel(a.filename)}</div>
                                    <div className="text-xs text-muted flex gap-2">
                                      <span className="truncate">{formatBytes(a.size)}</span>
                                      {url && (
                                        <a
                                          className="underline underline-offset-2"
                                          href={url}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Abrir
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className={cn(
                                    "h-8 w-8 rounded-full grid place-items-center",
                                    "opacity-0 group-hover:opacity-100 transition-opacity"
                                  )}
                                  style={{
                                    background: "var(--card)",
                                    border: "1px solid var(--border)",
                                  }}
                                  title="Eliminar adjunto"
                                  aria-label="Eliminar adjunto"
                                  disabled={busy}
                                  onClick={() => void removeSavedAttachment(a.id)}
                                >
                                  <span className="text-xs">{busy ? "…" : "✕"}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {modalMode === "EDIT" && savedAttachments.length === 0 && !uploadingAttachments && (
                      <div className="text-xs text-muted">Todavía no hay adjuntos.</div>
                    )}
                  </div>
                </Section>
              </div>
            </div>
          ) : null}

          {/* TAB CONFIG */}
          {tab === "CONFIG" ? (
            <div className="w-full space-y-4">
              {modalMode === "EDIT" ? (
                <Section
                  title={
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">Clave rápida (PIN)</div>
                        <div className="text-xs text-muted">
                          PIN de 4 dígitos para LockScreen / cambio rápido. (Admin)
                        </div>
                      </div>

                      <TPSegmentedPills
                        value={Boolean(detail?.pinEnabled)}
                        disabled={pinBusy || !detail?.hasQuickPin}
                        onChange={(v) => {
                          if (pinBusy) return;
                          if (!detail?.hasQuickPin) return;
                          void adminTogglePinEnabled(v);
                        }}
                        labels={{ on: "PIN habilitado", off: "PIN deshabilitado" }}
                      />
                    </div>
                  }
                  desc={null as any}
                >
                  <div className="space-y-3">
                    {pinMsg && (
                      <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
                        {pinMsg}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 tp-card p-3">
                      <div className="text-sm">
                        <span className="text-muted">PIN: </span>
                        <span className="font-semibold">
                          {detail?.hasQuickPin ? "••••" : "Sin PIN"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        className="tp-input"
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={4}
                        value={pinNew}
                        onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ""))}
                        placeholder="Nuevo PIN (4 dígitos)"
                        disabled={pinBusy}
                      />
                      <input
                        className="tp-input"
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={4}
                        value={pinNew2}
                        onChange={(e) => setPinNew2(e.target.value.replace(/\D/g, ""))}
                        placeholder="Confirmar PIN"
                        disabled={pinBusy}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn("tp-btn-primary inline-flex items-center gap-2", pinBusy && "opacity-60")}
                        disabled={pinBusy}
                        onClick={() => void adminSetOrResetPin()}
                      >
                        {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Configurar / Cambiar PIN
                      </button>

                      <button
                        type="button"
                        className={cn("tp-btn-secondary inline-flex items-center gap-2", pinBusy && "opacity-60")}
                        disabled={pinBusy || !detail?.hasQuickPin}
                        onClick={() => void adminRemovePin()}
                        title={!detail?.hasQuickPin ? "No hay PIN para eliminar" : "Eliminar PIN"}
                      >
                        {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                        Eliminar PIN
                      </button>
                    </div>

                    <p className="text-xs text-muted">
                      Tip: si el PIN está definido pero deshabilitado, el usuario no podrá usarlo para desbloquear.
                    </p>
                  </div>
                </Section>
              ) : null}

              <Section title="Almacén favorito" desc="Se usará por defecto en operaciones.">
                <select
                  className="tp-input"
                  value={fFavWarehouseId}
                  onChange={(e) => setFFavWarehouseId(e.target.value)}
                  disabled={!canAdmin}
                >
                  <option value="">Sin favorito</option>

                  {activeAlmacenes.map((a) => {
                    const isSelected = String(fFavWarehouseId) === String(a.id);
                    return (
                      <option key={a.id} value={a.id} disabled={isSelected}>
                        {a.nombre} {a.codigo ? `(${a.codigo})` : ""}
                        {isSelected ? " (seleccionado)" : ""}
                      </option>
                    );
                  })}
                </select>

                <div className="mt-2 text-xs text-muted">
                  {fFavWarehouseId
                    ? `Seleccionado: ${warehouseLabelById(fFavWarehouseId) ?? fFavWarehouseId}`
                    : "Sin almacén favorito"}
                </div>
              </Section>

              <Section title="Roles del usuario" desc="Selección múltiple.">
                <div className="tp-card p-3 max-h-[260px] overflow-auto tp-scroll">
                  {rolesLoading ? (
                    <div className="text-sm text-muted flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando roles…
                    </div>
                  ) : roles.length === 0 ? (
                    <div className="text-sm text-muted">No hay roles.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {roles.map((r) => {
                        const checked = fRoleIds.includes((r as any).id);
                        return (
                          <label key={(r as any).id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={checked}
                              onChange={(e) =>
                                setFRoleIds((prev) =>
                                  e.target.checked
                                    ? [...prev, (r as any).id]
                                    : prev.filter((id) => id !== (r as any).id)
                                )
                              }
                            />
                            {roleLabel(r as any)}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">Si no seleccionás roles, queda sin permisos hasta asignar.</p>
              </Section>

              <Section
                title={
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2">Permisos especiales</span>

                    <TPSegmentedPills
                      value={specialEnabled}
                      onChange={(next) => {
                        setSpecialEnabled(next);
                        if (!next) {
                          // si apaga, el page se encarga de limpiar specialList
                        }
                      }}
                      disabled={!canAdmin}
                      labels={{
                        on: "Permisos habilitados",
                        off: "Permisos deshabilitados",
                      }}
                    />
                  </div>
                }
                desc="Opcional: Permitir/Denegar por permiso."
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-muted">Permiso</label>
                      <select
                        className="tp-input"
                        value={specialPermPick}
                        onChange={(e) => setSpecialPermPick(e.target.value)}
                        disabled={permsLoading || !specialEnabled}
                      >
                        <option value="">
                          {specialEnabled ? "Seleccionar…" : "Permisos especiales deshabilitados"}
                        </option>
                        {allPerms.map((p) => {
                          const alreadyAdded = specialListSorted.some((x) => x.permissionId === p.id);
                          return (
                            <option key={p.id} value={p.id} disabled={alreadyAdded}>
                              {permLabelByModuleAction(p.module, p.action)}
                              {alreadyAdded ? " (ya agregado)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-muted">Acción</label>
                      <select
                        className="tp-input"
                        value={specialEffectPick}
                        onChange={(e) => setSpecialEffectPick(e.target.value as any)}
                        disabled={!specialEnabled}
                      >
                        <option value="ALLOW">Permitir</option>
                        <option value="DENY">Denegar</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <button
                        className={cn(
                          "tp-btn-primary w-full",
                          (!specialEnabled || !specialPermPick || specialSaving) && "opacity-60"
                        )}
                        type="button"
                        disabled={!specialEnabled || !specialPermPick || specialSaving}
                        onClick={() => void addOrUpdateSpecial()}
                      >
                        {specialSaving ? "Guardando…" : "Agregar / Actualizar"}
                      </button>

                      <p className="mt-2 text-xs text-muted">
                        * Denegar pisa Permitir y pisa permisos heredados por roles.
                      </p>
                    </div>
                  </div>

                  <div className="tp-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="px-3 py-2 text-left">Permiso</th>
                          <th className="px-3 py-2 text-left">Acción</th>
                          <th className="px-3 py-2 text-right">Quitar</th>
                        </tr>
                      </thead>

                      <tbody>
                        {!specialEnabled ? (
                          <tr>
                            <td className="px-3 py-3 text-muted" colSpan={3}>
                              Permisos especiales deshabilitados.
                            </td>
                          </tr>
                        ) : specialListSorted.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-muted" colSpan={3}>
                              Sin permisos especiales.
                            </td>
                          </tr>
                        ) : (
                          specialListSorted.map((ov) => (
                            <tr key={ov.permissionId} className="border-t border-border">
                              <td className="px-3 py-2">{permLabelByModuleAction(
                                allPerms.find((x) => x.id === ov.permissionId)?.module,
                                allPerms.find((x) => x.id === ov.permissionId)?.action
                              )}</td>

                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                    ov.effect === "ALLOW"
                                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                      : "border-red-500/30 bg-red-500/15 text-red-300"
                                  )}
                                >
                                  {effectLabel(ov.effect)}
                                </span>
                              </td>

                              <td className="px-3 py-2 text-right">
                                <button
                                  className={cn("tp-btn", specialSaving && "opacity-60")}
                                  type="button"
                                  disabled={specialSaving}
                                  onClick={() => void removeSpecial(ov.permissionId)}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button className="tp-btn-secondary" type="button" onClick={onClose} disabled={modalBusy}>
              Cancelar
            </button>

            <button className={cn("tp-btn-primary", modalBusy && "opacity-60")} type="submit" disabled={modalBusy}>
              {modalBusy ? "Guardando…" : modalMode === "CREATE" ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
