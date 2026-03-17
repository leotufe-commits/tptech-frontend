import React from "react";
import { X, Save, Plus } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import type { TPAttachmentItem } from "../../../components/ui/TPAttachmentList";
import type { SellerRow } from "../../../services/sellers";
import type { UserListItem } from "../../../services/users";
import type { SellerDraft, WarehouseOption } from "./vendedor.types";
import { VendedorForm } from "./VendedorForm";

interface Props {
  open: boolean;
  editTarget: SellerRow | null;
  draft: SellerDraft;
  set: <K extends keyof SellerDraft>(key: K, value: SellerDraft[K]) => void;
  toggleWarehouse: (id: string) => void;
  submitted: boolean;
  busySave: boolean;
  busyAvatar: boolean;
  warehouses: WarehouseOption[];
  users: UserListItem[];
  usedUserIds: string[];
  deletingAttachmentId: string | null;
  stagedFiles: File[];
  onStagedFilesChange: (files: File[]) => void;
  onAvatarUpload: (file: File) => void;
  onApplyUserAvatar: (url: string) => void;
  onAddAttachment: (file: File) => void;
  onDeleteAttachment: (item: TPAttachmentItem) => void;
  onSave: () => void;
  onClose: () => void;
  firstInputRef: React.RefObject<HTMLInputElement | null>;
}

export function VendedorEditModal({
  open,
  editTarget,
  draft,
  set,
  toggleWarehouse,
  submitted,
  busySave,
  busyAvatar,
  warehouses,
  users,
  usedUserIds,
  deletingAttachmentId,
  stagedFiles,
  onStagedFilesChange,
  onAvatarUpload,
  onApplyUserAvatar,
  onAddAttachment,
  onDeleteAttachment,
  onSave,
  onClose,
  firstInputRef,
}: Props) {
  return (
    <Modal
      open={open}
      title={editTarget ? "Editar vendedor" : "Nuevo vendedor"}
      maxWidth="4xl"
      busy={busySave}
      onClose={onClose}
      footer={
        <>
          <TPButton variant="secondary" onClick={onClose} disabled={busySave} iconLeft={<X size={16} />}>
            Cancelar
          </TPButton>
          <TPButton variant="primary" onClick={onSave} loading={busySave} iconLeft={editTarget ? <Save size={16} /> : <Plus size={16} />}>
            {editTarget ? "Guardar" : "Crear vendedor"}
          </TPButton>
        </>
      }
    >
      <VendedorForm
        draft={draft}
        set={set}
        toggleWarehouse={toggleWarehouse}
        submitted={submitted}
        busySave={busySave}
        editTarget={editTarget}
        warehouses={warehouses}
        users={users}
        usedUserIds={usedUserIds}
        busyAvatar={busyAvatar}
        onAvatarUpload={onAvatarUpload}
        onApplyUserAvatar={onApplyUserAvatar}
        deletingAttachmentId={deletingAttachmentId}
        stagedFiles={stagedFiles}
        onStagedFilesChange={onStagedFilesChange}
        onAddAttachment={onAddAttachment}
        onDeleteAttachment={onDeleteAttachment}
        firstInputRef={firstInputRef}
      />
    </Modal>
  );
}
