// src/pages/article-detail/BarcodeScannerOverlay.tsx
// Overlay de scanner de barcode operativo (para uso con pistola/scanner físico o manual).
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Package,
  ScanBarcode,
  X,
} from "lucide-react";

import { cn } from "../../components/ui/tp";
import { TPButton } from "../../components/ui/TPButton";
import { toast } from "../../lib/toast";
import { articlesApi, type BarcodeLookupResult, fmtMoney } from "../../services/articles";

// ---------------------------------------------------------------------------
type ScanResult =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; data: BarcodeLookupResult & { found: true }; barcode: string }
  | { state: "notfound"; barcode: string }
  | { state: "error"; message: string };

// ---------------------------------------------------------------------------
export type BarcodeScannerOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export default function BarcodeScannerOverlay({
  open,
  onClose,
}: BarcodeScannerOverlayProps) {
  const navigate     = useNavigate();
  const inputRef     = useRef<HTMLInputElement>(null);
  const [value,      setValue]      = useState("");
  const [result,     setResult]     = useState<ScanResult>({ state: "idle" });
  const [history,    setHistory]    = useState<{ barcode: string; name: string; found: boolean }[]>([]);

  // Foco automático al abrir
  useEffect(() => {
    if (!open) { setValue(""); setResult({ state: "idle" }); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open]);

  // Búsqueda
  async function handleScan(barcode: string) {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setValue("");
    setResult({ state: "loading" });

    try {
      const res = await articlesApi.lookupByBarcode(trimmed);
      if (!res.found) {
        setResult({ state: "notfound", barcode: trimmed });
        setHistory((prev) => [{ barcode: trimmed, name: "No encontrado", found: false }, ...prev.slice(0, 9)]);
      } else {
        setResult({ state: "found", data: res, barcode: trimmed });
        setHistory((prev) => [
          { barcode: trimmed, name: res.article.name, found: true },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (e: any) {
      setResult({ state: "error", message: e?.message || "Error de conexión." });
    }

    // Re-focus para el siguiente scan
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      void handleScan(value);
    }
    if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-soft flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <ScanBarcode size={20} className="text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="font-bold text-text text-base">Scanner de barcode</h2>
            <p className="text-xs text-muted">Escaneá o escribí el código y presioná Enter</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-border bg-surface2/40 grid place-items-center hover:bg-surface2 transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-b border-border">
          <div className="relative flex items-center">
            <ScanBarcode size={16} className="absolute left-3 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Barcode…"
              className="tp-input pl-10 pr-10 h-11 w-full text-base font-mono tracking-wider"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {result.state === "loading" && (
              <Loader2 size={15} className="absolute right-3 text-muted animate-spin" />
            )}
            {value && result.state !== "loading" && (
              <button
                type="button"
                onClick={() => { setValue(""); inputRef.current?.focus(); }}
                className="absolute right-3 text-muted hover:text-text"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted mt-1.5 text-center">
            Compatible con pistola lectora de barcode · Presioná Enter para buscar
          </p>
        </div>

        {/* Result */}
        <div className="px-5 py-4 min-h-[120px]">
          {result.state === "idle" && (
            <div className="flex flex-col items-center justify-center h-24 text-center gap-2">
              <ScanBarcode size={32} className="text-muted/30" />
              <p className="text-sm text-muted">Esperando escaneo…</p>
            </div>
          )}

          {result.state === "loading" && (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <Loader2 size={24} className="text-primary animate-spin" />
              <p className="text-sm text-muted">Buscando…</p>
            </div>
          )}

          {result.state === "notfound" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-text">No encontrado</p>
                <p className="text-xs text-muted mt-0.5 font-mono">{result.barcode}</p>
                <p className="text-xs text-muted/60 mt-1">No hay ningún artículo con ese código de barras.</p>
              </div>
            </div>
          )}

          {result.state === "error" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{result.message}</p>
            </div>
          )}

          {result.state === "found" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              {/* Artículo */}
              <div className="flex items-start gap-3">
                {result.data.article.mainImageUrl ? (
                  <img
                    src={result.data.article.mainImageUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-surface2 border border-border flex items-center justify-center shrink-0">
                    <Package size={18} className="text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    <span className="text-[10px] text-emerald-400 font-medium">Encontrado</span>
                  </div>
                  <p className="font-semibold text-text text-sm mt-0.5 truncate">
                    {result.data.article.name}
                  </p>
                  <p className="text-xs text-muted font-mono">{result.data.article.code}</p>
                  {result.data.variant && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Layers size={10} className="text-muted" />
                      <span className="text-xs text-muted">{result.data.variant.name}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted/60 font-mono mt-0.5">{result.barcode}</p>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/articulos/${result.state === "found" ? result.data.articleId : ""}`);
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface2/40 hover:bg-surface2 transition py-1.5 text-xs font-medium text-text"
                >
                  <ExternalLink size={11} />
                  Ver artículo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Historial */}
        {history.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <p className="text-[10px] text-muted font-medium mb-2 uppercase tracking-wide">Historial reciente</p>
            <div className="space-y-1 max-h-28 overflow-y-auto tp-scroll">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    h.found ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <span className="font-mono text-muted/60 shrink-0 w-28 truncate">{h.barcode}</span>
                  <span className="truncate text-muted">{h.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
