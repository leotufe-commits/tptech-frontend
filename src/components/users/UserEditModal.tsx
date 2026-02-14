// tptech-frontend/src/components/users/UserEditModal.tsx
import React, { type FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { Loader2, Mail } from "lucide-react";

import { Modal } from "../ui/Modal";
import UserEditFooter from "./edit/UserEditFooter";

import SectionData from "./edit/sections/SectionData";
import SectionConfig from "./edit/sections/SectionConfig";
import { ConfirmModals } from "./edit/sections/ConfirmModals";

import { cn, Tabs, type TabKey, initialsFrom, absUrl, permLabelByModuleAction } from "./users.ui";

import type { Override, OverrideEffect, Role, UserAttachment, UserDetail } from "../../services/users";
import type { Permission } from "../../services/permissions";

import {
  shouldHidePinMsg,
  safeReadAutoPin,
  safeClearAutoPin,
  draftKeyOfFile,
} from "./edit/helpers/userEditModal.helpers";

import { useDraftAttachmentPreviews } from "./edit/hooks/useDraftAttachmentPreviews";
import UserAvatarCard from "./edit/partials/UserAvatarCard";

// ✅ API (cookie httpOnly)
import { apiFetch } from "../../lib/api";

/* =========================
   PROPS
========================= */
type Props = {
  open: boolean;
  wide?: boolean;
  modalMode: "CREATE" | "EDIT";
  modalBusy: boolean;
  modalLoading: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (e?: FormEvent) => Promise<void> | void;

  canAdmin: boolean;
  isSelfEditing: boolean;

  detail: UserDetail | null;

  tab: TabKey;
  setTab: (v: TabKey) => void;

  // fields
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
  setAvatarPreview: React.Dispatch<React.SetStateAction<string>>;
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
  handleDownloadSavedAttachment: (att: UserAttachment) => Promise<void> | void;

  // pin (draft)
  pinBusy: boolean;
  pinMsg: string | null;
  pinNew: string;
  setPinNew: (v: string) => void;
  pinNew2: string;
  setPinNew2: (v: string) => void;
  adminTogglePinEnabled: (next: boolean, opts?: { confirmRemoveOverrides?: boolean }) => Promise<void>;

  // ✅ CAMBIO: acepta pin/pin2 para no depender del state (evita “no dispara request”)
  adminSetOrResetPin: (opts?: { currentPin?: string; pin?: string; pin2?: string }) => Promise<void>;

  adminRemovePin: (opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) => Promise<void>;

  // warehouse
  fFavWarehouseId: string;
  setFFavWarehouseId: (v: string) => void;
  activeAlmacenes: Array<{ id: string; nombre: string; codigo: string }>;
  warehouseLabelById: (id?: string | null) => string | null;

  // roles
  roles: Role[];
  rolesLoading: boolean;
  fRoleIds: string[];
  setFRoleIds: React.Dispatch<React.SetStateAction<string[]>>;
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

  autoOpenPinFlow?: boolean;
  onAutoOpenPinFlowConsumed?: () => void;
};

/* ============================================================
   ✅ EVENTO GLOBAL (para que UsersTable actualice “Sin PIN / Habilitado”)
============================================================ */
const PIN_EVENT = "tptech:user-pin-updated";

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
    isSelfEditing,
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
    handleDownloadSavedAttachment,

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

    autoOpenPinFlow,
    onAutoOpenPinFlowConsumed,
  } = props;

  const isSelf = Boolean(isSelfEditing);
  const disableAdminDangerZone = isSelf;

  const [showPassword, setShowPassword] = useState(false);

  const isOwner = Boolean(
    detail?.roles?.some((r) =>
      String((r as any)?.code || (r as any)?.name || "")
        .toUpperCase()
        .trim() === "OWNER"
    )
  );

  /* ============================================================
     ✅ INVITE en MODAL (solo ADMIN + PENDING + EDIT + no self)
  ============================================================ */
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFlash, setInviteFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const inviteCooldownRef = useRef<number | null>(null);
  const inviteFlashTimerRef = useRef<number | null>(null);

  const detailStatus = String((detail as any)?.status || "").toUpperCase();
  const isPending = detailStatus === "PENDING";

  const canInviteHere =
    modalMode === "EDIT" && canAdmin && !isSelf && isPending && Boolean(String((detail as any)?.id || "").trim());

  function flashInvite(msg: string, type: "ok" | "err", ms: number) {
    setInviteFlash({ type, msg });
    if (inviteFlashTimerRef.current) window.clearTimeout(inviteFlashTimerRef.current);
    inviteFlashTimerRef.current = window.setTimeout(() => {
      setInviteFlash(null);
      inviteFlashTimerRef.current = null;
    }, ms);
  }

  async function sendInviteFromModal() {
    if (!canInviteHere) return;
    if (inviteBusy) return;
    if (inviteCooldownRef.current) return;

    const id = String((detail as any)?.id || "").trim();
    if (!id) return;

    setInviteBusy(true);
    setInviteFlash(null);

    try {
      await apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/invite`, { method: "POST" });
      flashInvite(`Invitación enviada a ${String((detail as any)?.email || "usuario")}.`, "ok", 2500);
    } catch (e: any) {
      flashInvite(e?.message || "No se pudo enviar la invitación.", "err", 3500);
    } finally {
      setInviteBusy(false);

      // cooldown 1.2s anti-spam
      inviteCooldownRef.current = window.setTimeout(() => {
        inviteCooldownRef.current = null;
      }, 1200);
    }
  }

  useEffect(() => {
    return () => {
      if (inviteFlashTimerRef.current) window.clearTimeout(inviteFlashTimerRef.current);
      inviteFlashTimerRef.current = null;

      if (inviteCooldownRef.current) window.clearTimeout(inviteCooldownRef.current);
      inviteCooldownRef.current = null;
    };
  }, []);

  /* ============================================================
     ✅ EMIT HELPER: avisa a UsersTable para que refleje el estado
  ============================================================ */
  function emitPinUpdated(payload: { hasQuickPin?: boolean; pinEnabled?: boolean }) {
    const userId = String((detail as any)?.id || "").trim();
    if (!userId) return;

    try {
      window.dispatchEvent(
        new CustomEvent(PIN_EVENT, {
          detail: { userId, ...payload },
        })
      );
    } catch {}
  }

  /* ============================================================
     ✅ WRAPPERS: luego de la acción real, notificamos a la tabla
  ============================================================ */
  async function adminSetOrResetPinWrapped(opts?: { currentPin?: string; pin?: string; pin2?: string }) {
    await adminSetOrResetPin(opts);
    emitPinUpdated({ hasQuickPin: true, pinEnabled: true });
  }

  async function adminRemovePinWrapped(opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) {
    await adminRemovePin(opts);
    emitPinUpdated({ hasQuickPin: false, pinEnabled: false });
  }

  async function adminTogglePinEnabledWrapped(next: boolean, opts?: { confirmRemoveOverrides?: boolean }) {
    await adminTogglePinEnabled(next, opts);
    emitPinUpdated({ hasQuickPin: true, pinEnabled: Boolean(next) });
  }

  // ===== PIN FLOW (UI) =====
  const [pinFlowOpen, setPinFlowOpen] = useState(false);
  const [pinFlowStep, setPinFlowStep] = useState<"NEW" | "CONFIRM">("NEW");
  const [pinDraft, setPinDraft] = useState("");
  const [pinDraft2, setPinDraft2] = useState("");

  const [confirmDisablePinClearsSpecialOpen, setConfirmDisablePinClearsSpecialOpen] = useState(false);
  const [pinToggling, setPinToggling] = useState(false);

  function openPinFlow() {
    setPinDraft("");
    setPinDraft2("");
    setPinFlowStep("NEW");
    setPinFlowOpen(true);

    setPinNew("");
    setPinNew2("");
  }

  function closePinFlow() {
    if (pinBusy || pinToggling) return;
    setPinFlowOpen(false);
    setPinDraft("");
    setPinDraft2("");
    setPinFlowStep("NEW");
  }

  /* ============================================================
     ✅ AUTO OPEN PIN FLOW (desde Users.tsx)
  ============================================================ */
  useEffect(() => {
    if (!open) return;
    if (!autoOpenPinFlow) return;
    if (modalMode !== "EDIT") return;

    const detailId = String((detail as any)?.id || "");
    if (!detailId) return;

    const hasRealPin = Boolean((detail as any)?.hasQuickPin);

    if (tab !== "CONFIG") {
      setTab("CONFIG");
      return;
    }

    if (hasRealPin) {
      onAutoOpenPinFlowConsumed?.();
      return;
    }

    if (!pinFlowOpen && !pinBusy && !pinToggling) {
      openPinFlow();
      onAutoOpenPinFlowConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoOpenPinFlow, modalMode, (detail as any)?.id, tab, pinFlowOpen, pinBusy, pinToggling]);

  /* ============================================================
     ✅ AUTO PIN LEGACY (sessionStorage)
  ============================================================ */
  useEffect(() => {
    if (!open) return;
    if (modalMode !== "EDIT") return;

    const detailId = String((detail as any)?.id || "");
    if (!detailId) return;

    if (autoOpenPinFlow) return;

    const auto = safeReadAutoPin();
    if (!auto?.userId) return;
    if (String(auto.userId) !== detailId) return;

    const hasRealPin = Boolean((detail as any)?.hasQuickPin);

    if (tab !== "CONFIG") {
      setTab("CONFIG");
      return;
    }

    if (hasRealPin) {
      safeClearAutoPin();
      return;
    }

    if (!pinFlowOpen && !pinBusy && !pinToggling) {
      openPinFlow();
      safeClearAutoPin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modalMode, (detail as any)?.id, tab, pinFlowOpen, pinBusy, pinToggling, autoOpenPinFlow]);

  function handleSubmit(e?: FormEvent) {
    if (e && pinFlowOpen) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    return onSubmit(e);
  }

  const { previewByKey: draftPreviewByKey } = useDraftAttachmentPreviews(attachmentsDraft);

  const [hiddenSavedAttIds, setHiddenSavedAttIds] = useState<Set<string>>(new Set());
  const [forceHideDetailAvatar, setForceHideDetailAvatar] = useState(false);

  const [confirmDisableSpecialOpen, setConfirmDisableSpecialOpen] = useState(false);
  const [specialClearing, setSpecialClearing] = useState(false);

  useEffect(() => {
    if (!open) return;

    setHiddenSavedAttIds(new Set());
    setForceHideDetailAvatar(false);

    setConfirmDisableSpecialOpen(false);
    setSpecialClearing(false);

    setConfirmDisablePinClearsSpecialOpen(false);
    setPinToggling(false);

    setShowPassword(false);

    setPinFlowOpen(false);
    setPinFlowStep("NEW");
    setPinDraft("");
    setPinDraft2("");
    setPinNew("");
    setPinNew2("");

    setInviteBusy(false);
    setInviteFlash(null);
  }, [open, detail?.id, setPinNew, setPinNew2]);

  function safeClose() {
    onClose();
  }

  // ✅ ESTADO REAL DEL PIN
  const detailHasQuickPin = Boolean(detail?.hasQuickPin);
  const detailPinEnabled = Boolean((detail as any)?.pinEnabled);
  const hasPin = detailHasQuickPin;

  const canShowPinToggle = Boolean(detailHasQuickPin);

  // ✅ FIX: NO bloquear PIN por self-edit.
  const canEditPin = Boolean(isSelf || canAdmin);
  const pinPillsDisabled = pinBusy || pinToggling || !canShowPinToggle || !canEditPin;

  const detailAvatar = !forceHideDetailAvatar && detail?.avatarUrl ? absUrl(String(detail.avatarUrl)) : "";
  const avatarSrc = avatarPreview || detailAvatar;

  const showPinMessage = !shouldHidePinMsg(pinMsg);

  const ownerRoleId = useMemo(() => {
    const r =
      roles.find((x: any) => String((x as any)?.code || "").toUpperCase() === "OWNER") ??
      roles.find((x: any) => String((x as any)?.name || "").toUpperCase() === "OWNER");
    return (r as any)?.id ? String((r as any).id) : null;
  }, [roles]);

  const selfOwnerChecked = Boolean(isSelf && ownerRoleId && fRoleIds.includes(ownerRoleId));

  const filteredSavedAttachments = useMemo(() => {
    if (!savedAttachments?.length) return [];
    if (!hiddenSavedAttIds.size) return savedAttachments;
    return savedAttachments.filter((a) => !hiddenSavedAttIds.has(String(a.id)));
  }, [savedAttachments, hiddenSavedAttIds]);

  const permById = useMemo(() => {
    const m = new Map<string, Permission>();
    for (const p of allPerms || []) m.set(String(p.id), p);
    return m;
  }, [allPerms]);

  function labelByPermId(permissionId: string) {
    const p = permById.get(String(permissionId));
    if (!p) return "Permiso desconocido";
    return permLabelByModuleAction(p.module, p.action);
  }

  async function handleRemoveSavedAttachment(id: string) {
    if (!id) return;
    try {
      setHiddenSavedAttIds((prev) => {
        const next = new Set(prev);
        next.add(String(id));
        return next;
      });
      await removeSavedAttachment(String(id));
    } catch (e) {
      setHiddenSavedAttIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
      throw e;
    }
  }

  async function handleRemoveAvatar() {
    if (avatarBusy || modalBusy) return;

    if (avatarPreview) {
      setAvatarPreview((prev) => {
        if (String(prev || "").startsWith("blob:")) URL.revokeObjectURL(String(prev));
        return "";
      });
      setAvatarFileDraft(null);
      setForceHideDetailAvatar(false);
      return;
    }

    if (modalMode === "EDIT" && detail?.avatarUrl) {
      await modalRemoveAvatar();
      setForceHideDetailAvatar(true);
      setAvatarPreview((prev) => {
        if (String(prev || "").startsWith("blob:")) URL.revokeObjectURL(String(prev));
        return "";
      });
      setAvatarFileDraft(null);
    }
  }

  async function clearAllSpecialOverrides() {
    const ids = specialListSorted.map((x) => String(x.permissionId)).filter(Boolean);
    for (const pid of ids) {
      await removeSpecial(pid);
    }
  }

  async function confirmDisableSpecialAndClear() {
    if (disableAdminDangerZone) return;
    setSpecialClearing(true);
    try {
      await clearAllSpecialOverrides();
      setSpecialPermPick("");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabled(false);
      setConfirmDisableSpecialOpen(false);
    } finally {
      setSpecialClearing(false);
    }
  }

  async function confirmDisablePinAndClearSpecial() {
    if (disableAdminDangerZone) return;

    setPinToggling(true);
    try {
      await adminTogglePinEnabledWrapped(false, { confirmRemoveOverrides: true });

      setSpecialPermPick("");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabled(false);

      setConfirmDisablePinClearsSpecialOpen(false);
    } finally {
      setPinToggling(false);
    }
  }

  const specialBlocked = disableAdminDangerZone || isOwner;
  const confirmOverlay = "bg-black/70 backdrop-blur-[1px]";

  // ✅ importante: el footer va DENTRO del form para que el submit funcione SIEMPRE
  const busyClose = modalBusy || avatarBusy || specialSaving || uploadingAttachments || Boolean(deletingAttId) || pinBusy;

  return (
    <>
      <ConfirmModals
        confirmOverlay={confirmOverlay}
        confirmDisablePinClearsSpecialOpen={confirmDisablePinClearsSpecialOpen}
        setConfirmDisablePinClearsSpecialOpen={setConfirmDisablePinClearsSpecialOpen}
        pinToggling={pinToggling}
        specialClearing={specialClearing}
        specialCount={specialListSorted.length}
        onConfirmDisablePinAndClearSpecial={() => void confirmDisablePinAndClearSpecial()}
        confirmDisableSpecialOpen={confirmDisableSpecialOpen}
        setConfirmDisableSpecialOpen={setConfirmDisableSpecialOpen}
        onConfirmDisableSpecialAndClear={() => void confirmDisableSpecialAndClear()}
      />

      <Modal
        open={open}
        wide={wide}
        title={title}
        onClose={safeClose}
        busy={modalBusy}
        // ✅ NO usar footer del Modal: necesitamos que el botón submit esté dentro del form
        footer={null as any}
      >
        {modalLoading ? (
          <div className={cn("tp-card p-4 text-sm text-muted flex items-center gap-2")}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Flash invite */}
            {inviteFlash ? (
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm border",
                  inviteFlash.type === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/30 bg-red-500/10 text-red-200"
                )}
              >
                {inviteFlash.msg}
              </div>
            ) : null}

            <UserAvatarCard
              modalMode={modalMode}
              modalBusy={modalBusy}
              avatarBusy={avatarBusy}
              avatarImgLoading={avatarImgLoading}
              setAvatarImgLoading={setAvatarImgLoading}
              avatarSrc={avatarSrc}
              avatarPreview={avatarPreview}
              detailHasAvatar={Boolean(!forceHideDetailAvatar && detail?.avatarUrl)}
              avatarInputModalRef={avatarInputModalRef}
              onPick={(f) => {
                setForceHideDetailAvatar(false);
                void pickAvatarForModal(f);
              }}
              onRemove={() => void handleRemoveAvatar()}
            />

            <Tabs value={tab} onChange={setTab} />

            {tab === "DATA" ? (
              <SectionData
                modalMode={modalMode}
                modalBusy={modalBusy}
                fEmail={fEmail}
                setFEmail={setFEmail}
                fPassword={fPassword}
                setFPassword={setFPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                fName={fName}
                setFName={setFName}
                fDocType={fDocType}
                setFDocType={setFDocType}
                fDocNumber={fDocNumber}
                setFDocNumber={setFDocNumber}
                fPhoneCountry={fPhoneCountry}
                setFPhoneCountry={setFPhoneCountry}
                fPhoneNumber={fPhoneNumber}
                setFPhoneNumber={setFPhoneNumber}
                fStreet={fStreet}
                setFStreet={setFStreet}
                fNumber={fNumber}
                setFNumber={setFNumber}
                fCity={fCity}
                setFCity={setFCity}
                fProvince={fProvince}
                setFProvince={setFProvince}
                fPostalCode={fPostalCode}
                setFPostalCode={setFPostalCode}
                fCountry={fCountry}
                setFCountry={setFCountry}
                fNotes={fNotes}
                setFNotes={setFNotes}
                attInputRef={attInputRef}
                uploadingAttachments={uploadingAttachments}
                deletingAttId={deletingAttId}
                attachmentsDraft={attachmentsDraft}
                removeDraftAttachmentByIndex={removeDraftAttachmentByIndex}
                addAttachments={addAttachments}
                filteredSavedAttachments={filteredSavedAttachments}
                handleRemoveSavedAttachment={handleRemoveSavedAttachment}
                handleDownloadSavedAttachment={handleDownloadSavedAttachment}
                draftKey={draftKeyOfFile}
                draftPreviewByKey={draftPreviewByKey}
                initialsFrom={(s: string) => initialsFrom(s)}
                avatarInitialsBase={fName || fEmail || "U"}
              />
            ) : null}

            {tab === "CONFIG" ? (
              <SectionConfig
                modalMode={modalMode}
                disableAdminDangerZone={disableAdminDangerZone}
                confirmOverlay={confirmOverlay}
                canAdmin={canAdmin}
                isOwner={isOwner}
                detailHasQuickPin={detailHasQuickPin}
                detailPinEnabled={detailPinEnabled}
                pinFlowOpen={pinFlowOpen}
                openPinFlow={openPinFlow}
                closePinFlow={closePinFlow}
                hasPin={hasPin}
                pinFlowStep={pinFlowStep}
                setPinFlowStep={setPinFlowStep}
                pinDraft={pinDraft}
                setPinDraft={setPinDraft}
                pinDraft2={pinDraft2}
                setPinDraft2={setPinDraft2}
                pinBusy={pinBusy}
                pinToggling={pinToggling}
                pinPillsDisabled={pinPillsDisabled}
                pinMsg={pinMsg}
                showPinMessage={showPinMessage}
                setPinNew={setPinNew}
                setPinNew2={setPinNew2}
                pinNew={pinNew}
                pinNew2={pinNew2}
                adminSetOrResetPin={adminSetOrResetPinWrapped}
                adminTogglePinEnabled={adminTogglePinEnabledWrapped}
                adminRemovePin={adminRemovePinWrapped}
                specialListSorted={specialListSorted}
                setConfirmDisablePinClearsSpecialOpen={setConfirmDisablePinClearsSpecialOpen}
                specialBlocked={specialBlocked}
                specialEnabled={specialEnabled}
                setSpecialEnabled={setSpecialEnabled}
                specialPermPick={specialPermPick}
                setSpecialPermPick={setSpecialPermPick}
                specialEffectPick={specialEffectPick}
                setSpecialEffectPick={setSpecialEffectPick}
                specialSaving={specialSaving}
                specialClearing={specialClearing}
                allPerms={allPerms}
                permsLoading={permsLoading}
                addOrUpdateSpecial={addOrUpdateSpecial}
                removeSpecial={removeSpecial}
                labelByPermId={labelByPermId}
                setConfirmDisableSpecialOpen={setConfirmDisableSpecialOpen}
                fFavWarehouseId={fFavWarehouseId}
                setFFavWarehouseId={setFFavWarehouseId}
                activeAlmacenes={activeAlmacenes}
                warehouseLabelById={warehouseLabelById}
                roles={roles}
                rolesLoading={rolesLoading}
                fRoleIds={fRoleIds}
                setFRoleIds={setFRoleIds}
                roleLabel={roleLabel}
                isSelf={isSelf}
                ownerRoleId={ownerRoleId}
                selfOwnerChecked={selfOwnerChecked}
              />
            ) : null}

            {/* Footer row: Invite (izq) + Footer (der) */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {canInviteHere ? (
                  <button
                    type="button"
                    className={cn("tp-btn-secondary", (inviteBusy || busyClose) && "opacity-60")}
                    disabled={inviteBusy || busyClose}
                    onClick={() => void sendInviteFromModal()}
                    title={inviteBusy ? "Enviando…" : "Enviar invitación"}
                  >
                    {inviteBusy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Enviar invitación
                      </span>
                    )}
                  </button>
                ) : null}
              </div>

              <UserEditFooter modalBusy={modalBusy} modalMode={modalMode} onCancel={safeClose} />
            </div>

            {busyClose ? null : null}
          </form>
        )}
      </Modal>
    </>
  );
}
