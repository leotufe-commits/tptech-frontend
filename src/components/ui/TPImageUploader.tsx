// src/components/ui/TPImageUploader.tsx
import React from "react";
import { cn } from "./tp";
import TPDropzone from "./TPDropzone";
import Avatar from "./Avatar";

type Props = {
  imageUrl?: string | null;
  name?: string | null;
  email?: string | null;

  size?: number;
  rounded?: "full" | "xl";

  loading?: boolean;
  disabled?: boolean;

  onUpload: (file: File) => void | Promise<void>;
  onDelete?: () => void;

  className?: string;
};

export default function TPImageUploader({
  imageUrl,
  name,
  email,
  size = 96,
  rounded = "xl",
  loading,
  disabled,
  onUpload,
  onDelete,
  className,
}: Props) {
  const hasImage = Boolean(imageUrl);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Preview (Avatar ya maneja fallback a iniciales) */}
      <Avatar
        src={imageUrl}
        name={name ?? undefined}
        email={email ?? undefined}
        size={size}
        rounded={rounded}
      />

      {/* Upload / Replace */}
      <TPDropzone
        multiple={false}
        accept="image/*"
        previewUrl={imageUrl ?? null}
        loading={loading}
        disabled={disabled}
        onDelete={onDelete}
        onFiles={(files) => {
          if (!files?.length) return;
          onUpload(files[0]);
        }}
        title={hasImage ? "Cambiar imagen" : "Agregar imagen +"}
        subtitle="Solo imágenes"
      />
    </div>
  );
}