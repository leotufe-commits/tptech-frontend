// tptech-frontend/src/pages/Users.tsx
import React from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

import { Modal } from "../components/ui/Modal";
import ConfirmUnsavedChangesDialog from "../components/ui/ConfirmUnsavedChangesDialog";
import { TPButton } from "../components/ui/TPButton";
import TPAlert from "../components/ui/TPAlert";

import UsersTable from "../components/users/UsersTable";
import UserEditModal from "../components/users/UserEditModal";

import { useUsersPage } from "../hooks/useUsersPage";

// ✅ FIX: no pasar undefined as any
import { prefetchUserDetail as prefetchUserDetailFn } from "../components/users/users.data";

export default function UsersPage() {
  const p = useUsersPage();

  // ✅ FIX TS: pinOnly puede existir en runtime pero no está tipado en el return del hook
  const pinOnly = Boolean((p as any)?.pinOnly);

  if (!p.canView) return <div className="p-6">Sin permisos para ver usuarios.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-0">
      <ConfirmUnsavedChangesDialog
        open={p.confirmUnsavedOpen}
        busy={p.busyClose}
        onClose={() => p.setConfirmUnsavedOpen(false)}
        onDiscard={() => {
          p.setConfirmUnsavedOpen(false);
          void p.closeModalHard();
        }}
        title="Cambios sin guardar"
        description={
          <>
            Hiciste cambios que todavía <b>no se guardaron</b>. Si cerrás ahora, se van a perder.
            <br />
            ¿Querés descartar cambios y cerrar?
          </>
        }
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Usuarios</h1>
            <p className="text-sm text-muted">
              Gestión de usuarios, roles, permisos especiales, avatar, adjuntos y almacén favorito.
            </p>
          </div>

          {Boolean(String(p.returnToRef.current || "").trim()) && (
            <TPButton
              variant="secondary"
              iconLeft={<ArrowLeft className="h-4 w-4" />}
              onClick={() => {
                if (p.modalOpen && p.isDirtyNow()) {
                  p.setConfirmUnsavedOpen(true);
                  return;
                }
                p.goBackIfReturnTo();
              }}
            >
              Volver
            </TPButton>
          )}
        </div>
      </div>

      {p.err && <TPAlert tone="danger">{p.err}</TPAlert>}

      <UsersTable
        loading={p.loading}
        users={p.users}
        search={p.qUI}
        onSearchChange={p.setQUI}
        actions={
          p.canAdmin ? (
            <TPButton onClick={p.openCreate} iconLeft={<Plus className="h-4 w-4" />}>
              Nuevo usuario
            </TPButton>
          ) : undefined
        }
        page={p.page}
        pageSize={p.limit}
        total={p.total}
        onPageChange={(pg) => p.setPage(pg)}
        onPageSizeChange={(s) => { p.setLimit(s); p.setPage(1); }}
        canAdmin={p.canAdmin}
        canEditStatus={p.canEditStatus}
        meId={p.me?.id ?? null}
        roleLabel={p.roleLabel}
        warehouseLabelById={p.warehouseLabelById}
        toggleStatus={p.toggleStatus}
        openEdit={p.openEdit}
        askDelete={p.askDelete}
        prefetchUserDetail={prefetchUserDetailFn}
      />

      <UserEditModal
        open={p.modalOpen}
        wide
        // ✅ NUEVO: cuando venís desde SystemPinSettings, se oculta el modal grande y solo se muestra el PIN
        pinOnly={pinOnly}
        modalMode={p.modalMode}
        modalBusy={p.modalBusy}
        modalLoading={p.modalLoading}
        title={p.modalMode === "CREATE" ? "Crear usuario" : `Editar usuario • ${p.detail?.email ?? ""}`}
        onClose={p.closeModal}
        onSubmit={p.saveModal}
        canAdmin={p.canAdmin}
        isSelfEditing={p.isSelfEditing}
        detail={p.detail}
        tab={p.tab}
        setTab={p.setTab}
        fEmail={p.fEmail}
        setFEmail={p.setFEmail}
        fFirstName={p.fFirstName}
        setFFirstName={p.setFFirstName}
        fLastName={p.fLastName}
        setFLastName={p.setFLastName}
        fPassword={p.fPassword}
        setFPassword={p.setFPassword}
        fPhoneCountry={p.fPhoneCountry}
        setFPhoneCountry={p.setFPhoneCountry}
        fPhoneNumber={p.fPhoneNumber}
        setFPhoneNumber={p.setFPhoneNumber}
        fDocType={p.fDocType}
        setFDocType={p.setFDocType}
        fDocNumber={p.fDocNumber}
        setFDocNumber={p.setFDocNumber}
        fStreet={p.fStreet}
        setFStreet={p.setFStreet}
        fNumber={p.fNumber}
        setFNumber={p.setFNumber}
        fFloor={p.fFloor}
        setFFloor={p.setFFloor}
        fApartment={p.fApartment}
        setFApartment={p.setFApartment}
        fCity={p.fCity}
        setFCity={p.setFCity}
        fProvince={p.fProvince}
        setFProvince={p.setFProvince}
        fPostalCode={p.fPostalCode}
        setFPostalCode={p.setFPostalCode}
        fCountry={p.fCountry}
        setFCountry={p.setFCountry}
        fNotes={p.fNotes}
        setFNotes={p.setFNotes}
        avatarBusy={p.avatarBusy}
        avatarImgLoading={p.avatarImgLoading}
        setAvatarImgLoading={p.setAvatarImgLoading}
        avatarPreview={p.avatarPreview}
        setAvatarPreview={p.setAvatarPreview}
        avatarInputModalRef={p.avatarInputModalRef}
        pickAvatarForModal={p.pickAvatarForModal}
        modalRemoveAvatar={p.modalRemoveAvatar}
        setAvatarFileDraft={p.setAvatarFileDraft}
        attInputRef={p.attInputRef}
        uploadingAttachments={p.uploadingAttachments}
        deletingAttId={p.deletingAttId}
        attachmentsDraft={p.attachmentsDraft}
        removeDraftAttachmentByIndex={p.removeDraftAttachmentByIndex}
        addAttachments={p.addAttachments}
        removeSavedAttachment={p.removeSavedAttachment}
        savedAttachments={p.savedAttachments}
        handleDownloadSavedAttachment={p.handleDownloadSavedAttachment}
        // ✅ FIX BUILD: UserEditModal no tipa/expone esta prop
        // handleOpenSavedAttachment={p.handleOpenSavedAttachment}
        pinBusy={p.pinBusy}
        pinMsg={p.pinMsg}
        pinNew={p.pinNew}
        setPinNew={p.setPinNew}
        pinNew2={p.pinNew2}
        setPinNew2={p.setPinNew2}
        adminTogglePinEnabled={p.adminTogglePinEnabled}
        adminSetOrResetPin={p.adminSetOrResetPin}
        adminRemovePin={p.adminRemovePin}
        // ✅ NUEVO: regla “último PIN” (bloqueo por PIN activo)
        pinLockEnabled={p.pinLockEnabled}
        usersWithPinCount={p.usersWithPinCount}
        fFavWarehouseId={p.fFavWarehouseId}
        setFFavWarehouseId={p.setFFavWarehouseId}
        activeAlmacenes={p.activeAlmacenes}
        warehouseLabelById={p.warehouseLabelById}
        roles={p.roles}
        rolesLoading={p.rolesLoading}
        fRoleIds={p.fRoleIds}
        setFRoleIds={p.setFRoleIds}
        roleLabel={p.roleLabel}
        allPerms={p.allPerms}
        permsLoading={p.permsLoading}
        specialEnabled={p.specialEnabled}
        setSpecialEnabled={(v) => {
          if (p.isSelfEditing) {
            p.setErr("No podés editar permisos especiales en tu propio usuario.");
            return;
          }
          p.setSpecialEnabledState(v);
        }}
        specialPermPick={p.specialPermPick}
        setSpecialPermPick={p.setSpecialPermPick}
        specialEffectPick={p.specialEffectPick}
        setSpecialEffectPick={p.setSpecialEffectPick}
        specialSaving={p.specialSaving}
        specialListSorted={p.specialListSorted}
        addOrUpdateSpecial={p.addOrUpdateSpecial}
        removeSpecial={p.removeSpecial}
        autoOpenPinFlow={p.autoOpenPinFlow}
        onAutoOpenPinFlowConsumed={() => p.setAutoOpenPinFlow(false)}
        onRequestEnablePinLock={p.handleRequestEnablePinLock}
      />

      <Modal
        open={p.confirmOpen}
        title="Eliminar usuario"
        onClose={() => {
          if (p.deleteBusy) return;
          p.setConfirmOpen(false);
          p.setDeleteTarget(null);
        }}
      >
        <div className="space-y-4">
          <div className="text-sm">
            Vas a eliminar (soft delete) a: <span className="font-semibold">{p.deleteTarget?.email}</span>
            <div className="mt-2 text-xs text-muted">
              - Se bloquea el usuario y se invalida la sesión. <br />
              - Se liberará el email para poder recrearlo. <br />
              - Se limpian roles/permisos especiales y se quita el avatar.
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <TPButton
              variant="secondary"
              disabled={p.deleteBusy}
              onClick={() => {
                p.setConfirmOpen(false);
                p.setDeleteTarget(null);
              }}
            >
              Cancelar
            </TPButton>

            <TPButton
              variant="danger"
              loading={p.deleteBusy}
              onClick={() => void p.confirmDelete()}
              iconLeft={<Trash2 className="h-4 w-4" />}
            >
              Eliminar
            </TPButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}