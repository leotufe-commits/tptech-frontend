// src/components/ui/TPAttachmentList.tsx
import React from "react";
import { Eye, Download, Trash2, FileText } from "lucide-react";
import { TPCard } from "./TPCard";
import TPIconButton from "./TPIconButton";
import { cn } from "./tp";

export type TPAttachmentItem = {
  id: string;
  name: string;
  size?: number;
  url?: string;
  mimeType?: string;
};

type Props = {
  items: TPAttachmentItem[];

  loading?: boolean;
  deletingId?: string | null;

  onView?: (item: TPAttachmentItem) => void;
  onDownload?: (item: TPAttachmentItem) => void;
  onDelete?: (item: TPAttachmentItem) => void;

  emptyText?: string;
  className?: string;
};

function formatBytes(bytes?: number) {
  if (typeof bytes !== "number") return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function isImage(mime?: string, name?: string) {
  const s = String(mime || name || "").toLowerCase();
  return (
    s.startsWith("image/") ||
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

export function TPAttachmentList({
  items,
  loading,
  deletingId,
  onView,
  onDownload,
  onDelete,
  emptyText = "Todavía no hay adjuntos.",
  className,
}: Props) {
  if (!items || items.length === 0) {
    return <div className="text-sm text-muted">{emptyText}</div>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => {
        const busy = Boolean(loading || (deletingId && deletingId === item.id));
        const img = isImage(item.mimeType, item.name);

        return (
          <TPCard key={item.id} className="p-3 bg-[color-mix(in_oklab,var(--card)_92%,var(--bg))]">
            <div className="flex items-center gap-3">
              {/* Preview */}
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg grid place-items-center border border-border bg-surface2">
                {img && item.url ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-muted" />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text" title={item.name}>
                  {item.name}
                </div>
                <div className="text-xs text-muted">{formatBytes(item.size)}</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {onView && (
                  <TPIconButton title="Ver" disabled={!item.url || busy} onClick={() => onView(item)}>
                    <Eye className="h-4 w-4" />
                  </TPIconButton>
                )}

                {onDownload && (
                  <TPIconButton
                    title="Descargar"
                    disabled={!item.url || busy}
                    onClick={() => onDownload(item)}
                  >
                    <Download className="h-4 w-4" />
                  </TPIconButton>
                )}

                {onDelete && (
                  <TPIconButton title="Eliminar" disabled={busy} onClick={() => onDelete(item)}>
                    <Trash2 className="h-4 w-4" />
                  </TPIconButton>
                )}
              </div>
            </div>
          </TPCard>
        );
      })}
    </div>
  );
}

export default TPAttachmentList;