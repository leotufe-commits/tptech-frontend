// src/components/ui/Toaster.tsx
import { useEffect, useMemo, useState } from "react";
import { onToast, type ToastPayload } from "../../lib/toast";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ variant }: { variant: ToastPayload["variant"] }) {
  const cls = "h-5 w-5";
  if (variant === "success") return <CheckCircle2 className={cn(cls)} />;
  if (variant === "warning") return <AlertTriangle className={cn(cls)} />;
  if (variant === "error") return <XCircle className={cn(cls)} />;
  return <Info className={cn(cls)} />;
}

export default function Toaster() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    return onToast((t) => {
      setItems((prev) => [t, ...prev].slice(0, 5));
      const ms = t.durationMs ?? 3200;
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, ms);
    });
  }, []);

  const variantRing = useMemo(
    () => ({
      success: "ring-emerald-500/25",
      warning: "ring-amber-500/25",
      error: "ring-rose-500/25",
      info: "ring-sky-500/25",
    }),
    []
  );

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-2xl border border-border bg-surface p-3 shadow-lg ring-1",
            variantRing[t.variant]
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Icon variant={t.variant} />
            </div>

            <div className="min-w-0 flex-1">
              {t.title ? (
                <div className="truncate text-sm font-semibold">{t.title}</div>
              ) : null}
              <div className="text-sm text-muted-foreground">{t.message}</div>
            </div>

            <button
              type="button"
              className="rounded-lg p-1 hover:bg-black/5"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
