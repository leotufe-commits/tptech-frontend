// src/components/ui/TPDropzone.tsx
import React from "react";
import { cn } from "./tp";
import { TPButton } from "./TPButton";
import TPIconButton from "./TPIconButton";
import { X } from "lucide-react";

type Props = {
  multiple?: boolean;
  accept?: string;

  disabled?: boolean;
  loading?: boolean;

  title?: string;
  subtitle?: string;

  previewUrl?: string | null;
  onDelete?: () => void;

  onFiles: (files: File[]) => void | Promise<void>;

  className?: string;
};

export default function TPDropzone({
  multiple = true,
  accept,
  disabled,
  loading,
  title = "Click para agregar archivos +",
  subtitle = "También podés arrastrar y soltar acá",
  previewUrl,
  onDelete,
  onFiles,
  className,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const busy = Boolean(disabled || loading);

  async function handleFiles(listLike: FileList | File[] | null | undefined) {
    if (busy) return;
    const files = Array.from(listLike || []);
    if (!files.length) return;
    const finalFiles = multiple ? files : [files[0]];
    await onFiles(finalFiles);
  }

  const isImagePreview = !multiple && previewUrl;

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept}
        disabled={busy}
        onChange={async (e) => {
          const files = e.target.files;
          e.currentTarget.value = "";
          await handleFiles(files);
        }}
      />

      {isImagePreview ? (
        <div className="relative w-24 h-24">
          <div
            role="button"
            onClick={() => !busy && inputRef.current?.click()}
            className={cn(
              "w-24 h-24 rounded-2xl overflow-hidden border border-border bg-surface2",
              "cursor-pointer relative group",
              busy && "opacity-60 pointer-events-none"
            )}
          >
            <img
              src={previewUrl!}
              alt="preview"
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">
              {loading ? "Subiendo…" : "Cambiar"}
            </div>
          </div>

          {onDelete && !busy && (
            <div className="absolute -top-2 -right-2">
              <TPIconButton
                className="h-7 w-7 rounded-full bg-surface2"
                onClick={onDelete}
              >
                <X className="h-4 w-4" />
              </TPIconButton>
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (busy) return;
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (busy) return;
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (busy) return;
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            await handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "w-full rounded-2xl border border-dashed",
            "min-h-[160px] flex flex-col items-center justify-center text-center px-6 py-6",
            "transition",
            busy && "opacity-60 pointer-events-none",
            dragOver
              ? "border-primary/60 bg-primary/10"
              : "border-border bg-surface"
          )}
        >
          <div className="text-sm text-text">
            {loading ? "Subiendo archivos…" : title}
          </div>

          <div className="mt-1 text-[11px] text-muted">
            {dragOver ? "Soltá para adjuntar" : subtitle}
          </div>

          <div className="mt-4">
            <TPButton
              variant="secondary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Elegir {multiple ? "archivos" : "archivo"}
            </TPButton>
          </div>
        </div>
      )}
    </div>
  );
}