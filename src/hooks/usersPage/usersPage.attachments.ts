// tptech-frontend/src/hooks/usersPage/usersPage.attachments.ts

type AttachmentLike = {
  id?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
};

type DownloadArgs = {
  userId: string;
  attachment: AttachmentLike;
};

type OpenArgs = DownloadArgs & {
  onPopupBlockedDownload?: () => Promise<void> | void;
};

// ✅ Descarga usando navegación normal (envía cookies si es mismo dominio)
export async function downloadUserAttachmentWithAuth(args: DownloadArgs): Promise<void> {
  const url = String(args?.attachment?.url || "").trim();
  if (!url) throw new Error("Adjunto sin URL.");

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const filename = String(args?.attachment?.filename || "").trim();
  if (filename) a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ✅ Abrir en nueva pestaña; si el popup está bloqueado, cae a download
export async function openUserAttachmentWithAuth(args: OpenArgs): Promise<void> {
  const url = String(args?.attachment?.url || "").trim();
  if (!url) throw new Error("Adjunto sin URL.");

  const w = window.open(url, "_blank", "noopener,noreferrer");

  if (!w) {
    if (args.onPopupBlockedDownload) {
      await args.onPopupBlockedDownload();
      return;
    }
    await downloadUserAttachmentWithAuth(args);
  }
}