// tptech-frontend/src/components/users/UsersAttachmentPanel.tsx
import React from "react";
import { Loader2, X } from "lucide-react";

import { cn } from "./users.ui";
import type { AttachmentItem, AttInfo } from "./users.utils";
import { userLabel, formatBytes } from "./users.utils";

type Props = {
  attPanelUserId: string | null;
  attPanelUser: any;
  attPanelInfo: AttInfo | null;
  attPanelLoading: boolean;
  attDownloadBusyId: string | null;
  attDownloadErr: string | null;
  iconBtnBase: string;
  closeAttPanel: () => void;
  downloadAttachment: (att: AttachmentItem) => Promise<void>;
};

export default function UsersAttachmentPanel({
  attPanelUserId,
  attPanelUser,
  attPanelInfo,
  attPanelLoading,
  attDownloadBusyId,
  attDownloadErr,
  iconBtnBase,
  closeAttPanel,
  downloadAttachment,
}: Props) {
  if (!attPanelUserId) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-4" onClick={closeAttPanel}>
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-soft overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              Adjuntos — {attPanelUser ? userLabel(attPanelUser) : "Usuario"}
            </div>
            <div className="text-xs text-muted truncate">
              {attPanelUser ? String(attPanelUser.email || "") : ""}
            </div>
          </div>

          <button type="button" className={cn(iconBtnBase)} onClick={closeAttPanel} title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {attPanelLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando adjuntos…
            </div>
          ) : !attPanelInfo?.has ? (
            <div className="text-sm text-muted">Este usuario no tiene adjuntos.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted">
                {attPanelInfo?.count != null ? `${attPanelInfo.count} archivo(s)` : "Archivos"}
              </div>

              {attDownloadErr ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  {attDownloadErr}
                </div>
              ) : null}

              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {(attPanelInfo?.items ?? []).map((a) => {
                  const fname = String(a.filename || "archivo");
                  const sz = formatBytes(a.size);
                  const meta = [sz || "", a.mimeType ? String(a.mimeType) : ""].filter(Boolean).join(" • ");
                  const busy = attDownloadBusyId === String(a.id);

                  return (
                    <div key={a.id} className="p-3 flex items-center justify-between gap-3 bg-card">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{fname}</div>
                        <div className="text-xs text-muted truncate">{meta || "Archivo"}</div>
                      </div>

                      <button
                        type="button"
                        className={cn("tp-btn", "shrink-0", busy && "opacity-60")}
                        disabled={busy}
                        onClick={() => void downloadAttachment(a)}
                        title="Descargar"
                      >
                        {busy ? "Descargando…" : "Descargar"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-muted">
                Tip: usa cookie httpOnly (no Bearer), así que esto descarga sin romper auth.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
