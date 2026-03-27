import React, { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import Avatar from "./Avatar";
import TPImageActionOverlay from "./TPImageActionOverlay";
import { cn } from "./tp";

type Props = {
  /** imagen actual (puede ser relativa o absoluta, Avatar ya la resuelve) */
  src?: string | null;

  /** para iniciales (si no hay imagen) */
  name?: string | null;
  email?: string | null;

  /** tamaño en px */
  size?: number;

  /** bordes */
  rounded?: "full" | "xl";

  /** estado */
  disabled?: boolean;
  loading?: boolean;

  /** ✅ mostrar/ocultar acciones (Agregar/Editar/Eliminar) */
  showActions?: boolean;

  /** textos */
  addLabel?: string; // default "Agregar"
  editLabel?: string; // default "Editar"
  deleteLabel?: string; // default "Eliminar"

  /** validación opcional */
  accept?: string; // default "image/*"
  maxBytes?: number; // default 5MB
  onError?: (msg: string) => void;

  /** acciones */
  onUpload: (file: File) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;

  /** estilos */
  className?: string; // wrapper externo
  imgClassName?: string; // <img> (lo pasa a Avatar)

  /** ✅ estilos del cuadro (borde/box) */
  frameClassName?: string;
  frameStyle?: React.CSSProperties;

  /** cache-bust opcional */
  bust?: string | number;

  /** Ícono/nodo a mostrar cuando no hay imagen (reemplaza las iniciales) */
  fallbackIcon?: ReactNode;
};

export default function TPAvatarUploader({
  src,
  name,
  email,
  size = 80,
  rounded = "xl",
  disabled = false,
  loading = false,

  showActions = true,

  addLabel = "Agregar",
  editLabel = "Editar",
  deleteLabel = "Eliminar",

  accept = "image/*",
  maxBytes = 5 * 1024 * 1024, // 5MB
  onError,

  onUpload,
  onDelete,

  className,
  imgClassName,

  frameClassName,
  frameStyle,

  bust,
  fallbackIcon,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(""); // blob url

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const cleanSrc = String(src || "").trim();
  const hasServerImage = Boolean(cleanSrc);
  const hasImage = Boolean(preview) || hasServerImage;

  const effectiveSrc = useMemo(() => preview || cleanSrc || "", [preview, cleanSrc]);

  function openPicker() {
    if (disabled || loading) return;
    inputRef.current?.click();
  }

  async function handlePickFile(file: File | null) {
    if (!file) return;
    if (disabled || loading) return;

    const isImg = String(file.type || "").startsWith("image/");
    if (!isImg) {
      onError?.("El archivo debe ser una imagen.");
      return;
    }

    if (maxBytes && file.size > maxBytes) {
      const mb = (maxBytes / 1024 / 1024).toFixed(0);
      onError?.(`La imagen supera el máximo permitido (${mb} MB).`);
      return;
    }

    // preview optimista
    let blobUrl = "";
    try {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      blobUrl = URL.createObjectURL(file);
      setPreview(blobUrl);
    } catch {
      setPreview("");
    }

    try {
      await onUpload(file);
    } catch (e: any) {
      if (blobUrl?.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview("");
      onError?.(e?.message || "No se pudo subir la imagen.");
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (disabled || loading) return;

    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");

    try {
      await onDelete();
    } catch (e: any) {
      onError?.(e?.message || "No se pudo eliminar la imagen.");
    }
  }

  const radius = rounded === "full" ? 9999 : 16;

  const Frame = (
    <div
      className={cn(
        "relative overflow-hidden bg-card",
        // borde acorde al sistema (suave)
        "border border-border/50",
        // micro-ring para que no se vea “duro” (muy leve)
        "ring-1 ring-black/5",
        !disabled && !loading && "transition-colors hover:border-border/70",
        frameClassName
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        ...frameStyle,
      }}
    >
      {/* ✅ Avatar sin borde propio */}
      <Avatar
        framed={false}
        src={effectiveSrc}
        name={name ?? undefined}
        email={email ?? undefined}
        size={size}
        rounded={rounded}
        imgClassName={imgClassName}
        bust={bust}
        fallbackIcon={fallbackIcon}
      />

      {loading ? (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,0.22)" }}>
          <div className="h-7 w-7 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn("inline-block", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        disabled={disabled || loading || !showActions}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.currentTarget.value = ""; // ✅ re-subir la misma imagen
          void handlePickFile(f);
        }}
      />

      {/* ✅ En VIEW: no overlay, no íconos, no acciones */}
      {!showActions ? (
        Frame
      ) : (
        <TPImageActionOverlay
          hasImage={hasImage}
          disabled={disabled}
          loading={loading}
          onPick={openPicker}
          onDelete={onDelete ? handleDelete : undefined}
          addLabel={addLabel}
          editLabel={editLabel}
          deleteLabel={deleteLabel}
        >
          {Frame}
        </TPImageActionOverlay>
      )}
    </div>
  );
}