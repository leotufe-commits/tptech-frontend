// tptech-frontend/src/components/users/edit/partials/UserAvatarCard.tsx
import React from "react";
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
    avatarImgLoading,
    setAvatarImgLoading,
    avatarSrc,
    avatarPreview,
    detailHasAvatar,
    avatarInputModalRef,
    onPick,
    onRemove,
  } = props;

  return (
    <div className={cn("tp-card p-4")}>
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
              title={detailHasAvatar || Boolean(avatarPreview) ? "Editar avatar" : "Agregar avatar"}
              onClick={() => {
                if (!avatarBusy && !modalBusy) avatarInputModalRef.current?.click();
              }}
              disabled={avatarBusy || modalBusy}
            >
              {(avatarBusy || avatarImgLoading) && (
                <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,0.22)" }}>
                  <div className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                </div>
              )}

              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  onLoadStart={() => setAvatarImgLoading(true)}
                  onLoad={() => setAvatarImgLoading(false)}
                  onError={() => setAvatarImgLoading(false)}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                  {initialsFrom("U")}
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
                  {avatarBusy ? "SUBIENDO…" : detailHasAvatar || avatarPreview ? "EDITAR" : "AGREGAR"}
                </span>
              </div>
            </button>

            {(avatarPreview || detailHasAvatar) && (
              <button
                type="button"
                onClick={onRemove}
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
                if (!f) return;
                onPick(f);
              }}
            />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold">Imagen de Perfil</div>
            <div className="text-xs text-muted">
              {modalMode === "CREATE" ? "Podés elegirlo ahora (se sube al crear)." : "Elegí uno nuevo para actualizar al instante."}
            </div>
          </div>
        </div>

        {avatarPreview && (
          <button className="tp-btn" type="button" onClick={onRemove} disabled={avatarBusy || modalBusy}>
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}
