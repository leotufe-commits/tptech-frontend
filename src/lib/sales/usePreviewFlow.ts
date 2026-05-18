// src/lib/sales/usePreviewFlow.ts
// ============================================================================
// Hook reutilizable para orquestar el ciclo de PREVIEW de un documento
// (Factura, NC, Presupuesto, etc.) contra el motor backend.
//
// Encapsula:
//   - debounce del fetch (default 200 ms).
//   - anti-stale via `requestIdRef` (compartido con el caller — otros sitios
//     pueden mutarlo para invalidar fetches en vuelo, ej: `handleClientPick`,
//     `handleLineArticlePick`).
//   - status machine `idle | loading | ok | error`.
//   - cache de última respuesta válida + firma asociada.
//   - cancellation cleanup automático.
//
// DELIBERADO: el hook NO conoce el shape del draft, ni el payload, ni la API.
// Recibe `executePreview` y `onApplyPreview` como callbacks — el caller los
// cierra sobre el draft. La mecánica de stale-closures es EXPLÍCITA y manejada
// con refs internos (`executeRef`, `onApplyRef`, `onErrorRef`) que se
// actualizan en cada render. Esto significa que al disparar el timeout SIEMPRE
// se lee el closure MÁS RECIENTE (el que tiene el draft actual).
//
// Comportamiento vs. inline original (VentasFacturas.tsx pre-FASE 8.2.4b):
//   * Mismo debounce, misma anti-stale guard, misma cache de signature+result.
//   * Una mejora subtle: si el operador modifica un campo NO-pricing del draft
//     mientras un preview está en vuelo (ej: tipear en `notes`), el hook ahora
//     usa el draft MÁS RECIENTE al hidratar. El inline original capturaba el
//     draft del render que scheduló el timeout — bug subtle de stale closure.
//     Esta corrección NO altera el flujo de preview ni el shape de los datos.
// ============================================================================

import { useEffect, useRef, useState, type MutableRefObject } from "react";

export type PreviewStatus = "idle" | "loading" | "ok" | "error";

/**
 * Opciones del hook. El genérico `TResult` es el tipo del response de
 * preview (ej: `SalePreviewResult` para Factura).
 */
export type UsePreviewFlowOptions<TResult> = {
  /** Firma reproducible de los inputs comerciales. Cuando cambia, dispara
   *  un nuevo preview con debounce. `null` desactiva el flujo (sin fetch,
   *  cache reseteado, status="idle"). */
  signature: string | null;

  /** Master toggle. Cuando `false`, el flujo está desactivado y la cache se
   *  resetea (idle). Útil para suspender el preview cuando el modal está
   *  cerrado. Default `true`. */
  enabled?: boolean;

  /** Debounce en ms entre cambio de firma y fetch. Default 200. */
  debounceMs?: number;

  /** Ref de id de request — el caller la posee y la comparte con otros
   *  sitios que necesiten invalidar fetches en vuelo (ej: handleClientPick
   *  hace `++ref.current` al cambiar de cliente para descartar respuestas
   *  pendientes del cliente anterior).
   *
   *  El hook mutea este ref dentro del setTimeout: `myReqId = ++ref.current`.
   *  Anti-stale guard: si al volver el await el ref ya no coincide con
   *  `myReqId`, la respuesta se descarta. */
  requestIdRef: MutableRefObject<number>;

  /** Función async que ejecuta el fetch del preview. El caller la define
   *  cerrando sobre el draft + API client. El hook NO conoce el payload.
   *
   *  IMPORTANTE: esta función se lee del ref (refresca cada render), así
   *  que cuando el setTimeout fire, usa el closure MÁS RECIENTE — incluyendo
   *  cualquier cambio del draft no-pricing (ej: notes, terms). */
  executePreview: () => Promise<TResult>;

  /** Callback al recibir respuesta válida (no stale). El caller suele
   *  hidratar el draft acá (`onChange(applyPreviewToDraft(draft, res))`).
   *
   *  Idem `executePreview`: lee del ref → closure más reciente. */
  onApplyPreview: (result: TResult) => void;

  /** Callback en error (no stale). Default: no-op. El caller puede toastear,
   *  loguear, etc. */
  onPreviewError?: (error: unknown) => void;
};

/**
 * Result del hook. `cached` retiene la última respuesta válida y la firma
 * con la que se obtuvo — útil para consumidores que quieran validar paridad
 * `cached.signature === currentSignature` antes de leer datos.
 */
export type UsePreviewFlowResult<TResult> = {
  status: PreviewStatus;
  cached: { signature: string; result: TResult } | null;
};

export function usePreviewFlow<TResult>(
  options: UsePreviewFlowOptions<TResult>,
): UsePreviewFlowResult<TResult> {
  const {
    signature,
    enabled = true,
    debounceMs = 200,
    requestIdRef,
    executePreview,
    onApplyPreview,
    onPreviewError,
  } = options;

  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [cached, setCached] = useState<{ signature: string; result: TResult } | null>(null);

  // Refs anti-stale para callbacks que el caller cierra sobre el draft.
  // Actualizamos en cada render — esto NO es un useEffect deliberadamente:
  // cuando el setTimeout fire, leemos del ref el closure más reciente.
  // No usamos useEffect para esto porque queremos refresh sincrónico (sin
  // esperar al commit phase).
  const executeRef = useRef(executePreview);
  const onApplyRef = useRef(onApplyPreview);
  const onErrorRef = useRef(onPreviewError);
  executeRef.current = executePreview;
  onApplyRef.current = onApplyPreview;
  onErrorRef.current = onPreviewError;

  useEffect(() => {
    // Disabled or no inputs → reset cache, idle status.
    if (!signature || !enabled) {
      setCached(null);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const myReqId = ++requestIdRef.current;
    const sig = signature;

    const handle = setTimeout(async () => {
      try {
        const res = await executeRef.current();
        // Anti-stale guard: si otro fetch arrancó después de éste, descartar.
        if (requestIdRef.current !== myReqId) return;
        setCached({ signature: sig, result: res });
        setStatus("ok");
        onApplyRef.current(res);
      } catch (e) {
        // Anti-stale guard también para errores — no queremos marcar "error"
        // si un fetch posterior ya está en vuelo.
        if (requestIdRef.current === myReqId) {
          setStatus("error");
        }
        onErrorRef.current?.(e);
      }
    }, debounceMs);

    return () => clearTimeout(handle);
    // signature/enabled/debounceMs/requestIdRef son los únicos triggers del
    // efecto. executePreview/onApplyPreview/onPreviewError se leen del ref.
  }, [signature, enabled, debounceMs, requestIdRef]);

  return { status, cached };
}
