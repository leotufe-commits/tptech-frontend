// src/components/ui/TPAttachmentManager.tsx
// Agrupa TPDropzone + TPAttachmentList + descarga en un solo componente reutilizable.
import React, { useRef } from "react";
import { Plus } from "lucide-react";
import TPDropzone from "./TPDropzone";
import TPAttachmentList, { type TPAttachmentItem } from "./TPAttachmentList";
import { TPButton } from "./TPButton";

async function downloadItem(item: TPAttachmentItem) {
  if (!item.url) return;
  const res = await fetch(item.url, { credentials: "include" });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type Props = {
  /** Archivos ya guardados en el servidor */
  items: TPAttachmentItem[];
  /**
   * Si se provee, habilita la subida de archivos.
   * uploadVariant="dropzone" (por defecto) muestra el área drag & drop.
   * uploadVariant="button" muestra un botón compacto "+ Agregar".
   */
  onUpload?: (files: File[]) => void;
  uploadVariant?: "dropzone" | "button";
  /** Si se provee, muestra el botón de eliminar en cada ítem */
  onDelete?: (item: TPAttachmentItem) => void;
  deletingId?: string | null;
  disabled?: boolean;
  loading?: boolean;
  multiple?: boolean;
  emptyText?: string;
};

export default function TPAttachmentManager({
  items,
  onUpload,
  uploadVariant = "dropzone",
  onDelete,
  deletingId,
  disabled,
  loading,
  multiple = true,
  emptyText = "Todavía no hay adjuntos.",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleButtonClick() {
    fileInputRef.current?.click();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onUpload?.(files);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      {onUpload && uploadVariant === "button" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="flex justify-end">
            <TPButton
              variant="secondary"
              iconLeft={<Plus size={14} />}
              onClick={handleButtonClick}
              disabled={disabled}
              className="h-8 text-xs"
            >
              Agregar
            </TPButton>
          </div>
        </>
      )}

      {onUpload && uploadVariant === "dropzone" && (
        <TPDropzone
          multiple={multiple}
          disabled={disabled}
          loading={loading}
          onFiles={onUpload}
        />
      )}

      <TPAttachmentList
        items={items}
        deletingId={deletingId}
        onView={(item) => item.url && window.open(item.url, "_blank")}
        onDownload={items.some((i) => i.url) ? downloadItem : undefined}
        onDelete={onDelete}
        emptyText={emptyText}
      />
    </div>
  );
}
