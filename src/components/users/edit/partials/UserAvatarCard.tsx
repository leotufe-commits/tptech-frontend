// tptech-frontend/src/components/users/edit/partials/UserAvatarCard.tsx
import React from "react";

import TPAvatarUploader from "../../../ui/TPAvatarUploader";
import { cn, initialsFrom } from "../../users.ui";

type Props = {
  modalMode: "CREATE" | "EDIT";
  modalBusy: boolean;

  avatarBusy: boolean;
  avatarImgLoading: boolean;
  setAvatarImgLoading: (v: boolean) => void;

  avatarSrc: string;
  avatarPreview: string;
  detailHasAvatar: boolean;

  avatarInputModalRef: React.RefObject<HTMLInputElement>;
  onPick: (file: File) => void;

  onRemove: () => void;
};

export default function UserAvatarCard(props: Props) {
  const {
    modalMode,
    modalBusy,
    avatarBusy,

    avatarSrc,
    avatarPreview,
    detailHasAvatar,

    onPick,
    onRemove,
  } = props;

  const busy = modalBusy || avatarBusy;

  // preview primero, si no imagen del servidor
  const effectiveSrc = avatarPreview || avatarSrc;

  return (
    <div className={cn("tp-card p-4")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <TPAvatarUploader
              src={effectiveSrc}
              name={initialsFrom("U")}
              email={undefined}
              size={64}
              rounded="xl"
              disabled={busy}
              loading={busy}
              addLabel="Agregar"
              editLabel="Editar"
              deleteLabel={avatarPreview ? "Descartar" : "Eliminar avatar"}

              onUpload={(file) => onPick(file)}
              onDelete={
                detailHasAvatar || avatarPreview
                  ? () => onRemove()
                  : undefined
              }

              onError={() => {
                /* opcional: conectar a toast */
              }}

              /* 🎨 mejora visual del avatar */
              frameClassName={cn(
                "border border-border/30",
                "bg-transparent",
                "shadow-none"
              )}
              imgClassName="object-contain p-0.5"

              className=""
            />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold">Imagen de Perfil</div>

            <div className="text-xs text-muted">
              {modalMode === "CREATE"
                ? "Podés elegirlo ahora (se sube al crear)."
                : "Elegí uno nuevo para actualizar al instante."}
            </div>
          </div>
        </div>

        {avatarPreview ? (
          <button
            className="tp-btn"
            type="button"
            onClick={onRemove}
            disabled={busy}
          >
            Descartar
          </button>
        ) : null}
      </div>
    </div>
  );
}