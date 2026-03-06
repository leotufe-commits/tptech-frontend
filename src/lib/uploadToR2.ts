export async function uploadToSignedUrl(args: {
  uploadUrl: string;
  file: File;
}) {
  const res = await fetch(args.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": args.file.type || "application/octet-stream",
    },
    body: args.file,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falló upload (${res.status}). ${txt}`.trim());
  }

  return true;
}
