// tptech-frontend/src/hooks/useDraftAttachmentPreviews.ts
import { useEffect, useMemo, useState } from "react";

type Options = {
  isImage?: (f: File) => boolean;
};

function defaultIsImage(f: File) {
  return String(f?.type || "").startsWith("image/");
}

function draftKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

export function useDraftAttachmentPreviews(files: File[], opts?: Options) {
  const isImage = opts?.isImage ?? defaultIsImage;

  const [previewByKey, setPreviewByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    setPreviewByKey((prev) => {
      const next: Record<string, string> = { ...prev };
      const alive = new Set<string>();

      for (const f of files || []) {
        const k = draftKey(f);
        alive.add(k);

        if (isImage(f) && !next[k]) {
          try {
            next[k] = URL.createObjectURL(f);
          } catch {}
        }
      }

      for (const k of Object.keys(next)) {
        if (!alive.has(k)) {
          try {
            URL.revokeObjectURL(next[k]);
          } catch {}
          delete next[k];
        }
      }

      return next;
    });
  }, [files, isImage]);

  // cleanup total al unmount
  useEffect(() => {
    return () => {
      setPreviewByKey((prev) => {
        for (const k of Object.keys(prev)) {
          try {
            URL.revokeObjectURL(prev[k]);
          } catch {}
        }
        return {};
      });
    };
  }, []);

  const keyOf = useMemo(() => draftKey, []);
  return { previewByKey, keyOf };
}
