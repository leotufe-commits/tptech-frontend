// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/useInvoiceLayout.ts
//
// Hook que gobierna el layout V2 del modal de Factura. Hidrata desde
// UserPreference.invoiceLayoutConfig al abrir el modal, valida con
// reconcileLayout, y persiste con debounce cada cambio.
//
// Tambien expone "Mis vistas" (NamedLayoutPreset[]) — persistidas en el
// mismo JSON opaco bajo la key `savedPresets`. Solo precarga UI; no
// afecta pricing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { userPreferencesApi } from "../../../../services/user-preferences";
import {
  getDefaultLayoutForPreset,
  cloneLayout,
} from "./v2/presetLayouts";
import { reconcileLayout } from "./reconcileLayout";
import type {
  LayoutV2,
  NamedLayoutPreset,
  PersistenceStatus,
} from "./types";
import type { InvoiceViewPreset } from "../../../../lib/sales/invoiceViewPresets";

const DEBOUNCE_MS = 500;

type StoredShape = {
  layoutV2?: LayoutV2;
  savedPresets?: NamedLayoutPreset[];
  defaultPresetId?: string | null;
};

function genId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `preset_${ts}_${rnd}`;
}

function readStored(raw: unknown): StoredShape {
  if (!raw || typeof raw !== "object") return {};
  return raw as StoredShape;
}

export type UseInvoiceLayoutResult = {
  layoutV2: LayoutV2;
  /**
   * Aplica un layout nuevo. `opts.persist`:
   *   - `true` (default): cambio user-driven (drag, resize, preset, restore) →
   *     se persiste al backend con debounce.
   *   - `false`: cambio cosmético (auto-grow/shrink del motor de reflow,
   *     compactación interna por contenido) → solo actualiza estado, NO
   *     llama al backend. Evita disparar "Error al guardar" cuando el
   *     operador NO hizo nada y bloquea persistencia innecesaria de
   *     correcciones de display derivables del contenido en re-mount.
   */
  setLayoutV2: (next: LayoutV2, opts?: { persist?: boolean }) => void;

  // Snapshot / restore (modo edicion).
  takeSnapshot: () => void;
  restoreSnapshot: () => LayoutV2 | null;

  // Estado de persistencia.
  persistenceStatus: PersistenceStatus;
  /**
   * Persiste inmediatamente cualquier cambio pendiente del layout
   * (cancela el debounce). Resuelve cuando el PUT termina. Llamar
   * antes de cambios criticos (ej. cambio de preset) o al cerrar el
   * modal para evitar perder cambios in-flight.
   */
  flushSavePending: () => Promise<void>;

  // "Mis vistas" — CRUD de presets nombrados del usuario.
  presets: NamedLayoutPreset[];
  defaultPresetId: string | null;
  savePresetAs: (name: string) => string;
  applyPreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  duplicatePreset: (id: string) => string | null;
  deletePreset: (id: string) => void;
  setDefaultPresetId: (id: string | null) => void;
};

export function useInvoiceLayout(open: boolean): UseInvoiceLayoutResult {
  // Preset base actual (para el fallback default) — lo mantenemos local
  // pero el hook lo refresca cada vez que `setLayoutV2` se llama con una
  // geometria proveniente de `getDefaultLayoutForPreset(X)`.
  // Default para usuarios sin preferencia: COMPACT (decision producto
  // — vista densa optimizada para el flujo de ERP). El layout y el
  // preset persistidos del usuario, si existen, ganan siempre sobre
  // este default — el `useEffect` de hidratacion los sobreescribe.
  const presetRef = useRef<InvoiceViewPreset>("COMPACT");

  const [layoutV2, setLayoutV2State] = useState<LayoutV2>(
    () => cloneLayout(getDefaultLayoutForPreset(presetRef.current)),
  );
  const [presets, setPresets] = useState<NamedLayoutPreset[]>([]);
  const [defaultPresetId, setDefaultPresetIdState] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("idle");

  const snapshotRef = useRef<LayoutV2 | null>(null);
  const initializedRef = useRef(false);

  // ── Hidratacion al abrir el modal ──────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    let cancelled = false;
    setPersistenceStatus("idle");
    userPreferencesApi
      .get()
      .then((pref) => {
        if (cancelled) return;
        // Migracion de valores legacy persistidos (BALANCED / FINANCIAL
        // ya no son presets validos; ambos caen a COMPACT).
        const persistedRaw = (pref?.preferredInvoiceViewPreset ?? null) as string | null;
        const presetBase: InvoiceViewPreset =
          persistedRaw === "CLASSIC" || persistedRaw === "ONE_LINE"
            ? persistedRaw
            : "COMPACT";
        presetRef.current = presetBase;
        const stored = readStored(pref?.invoiceLayoutConfig);
        const reconciled = reconcileLayout(stored.layoutV2, presetBase);
        setLayoutV2State(reconciled);
        setPresets(Array.isArray(stored.savedPresets) ? stored.savedPresets : []);
        setDefaultPresetIdState(stored.defaultPresetId ?? null);
        initializedRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        // Falla la red -> usar default del preset COMPACT (default
        // de producto para usuarios sin preferencias).
        setLayoutV2State(cloneLayout(getDefaultLayoutForPreset("COMPACT")));
        initializedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ── Persistencia con debounce ──────────────────────────────────────────────
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<StoredShape | null>(null);

  const scheduleSave = useCallback(
    (next: StoredShape) => {
      if (!initializedRef.current) return;
      pendingPayloadRef.current = next;
      setPersistenceStatus("pending");
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        const payload = pendingPayloadRef.current;
        if (!payload) return;
        setPersistenceStatus("saving");
        try {
          await userPreferencesApi.update({ invoiceLayoutConfig: payload });
          setPersistenceStatus("saved");
          // Volver a idle a los pocos segundos para que el indicador
          // visual no quede pegado en "guardado".
          setTimeout(() => setPersistenceStatus("idle"), 1500);
        } catch {
          setPersistenceStatus("error");
        }
      }, DEBOUNCE_MS);
    },
    [],
  );

  /**
   * Persiste inmediatamente cualquier payload pendiente (cancela el
   * debounce). Devuelve una Promise que resuelve cuando el PUT termina.
   *
   * Caso de uso clave: el modal se cierra antes de que pasen los 500ms
   * del debounce. Sin flush, el `clearTimeout` del cleanup descarta el
   * payload pendiente y al reabrir el modal se ve el layout VIEJO,
   * con el preset NUEVO ya persistido por `useInvoiceViewPreset` — una
   * combinacion incoherente que el operador percibe como "no respeto
   * mi plantilla".
   */
  const flushSavePending = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    pendingPayloadRef.current = null;
    setPersistenceStatus("saving");
    try {
      await userPreferencesApi.update({ invoiceLayoutConfig: payload });
      setPersistenceStatus("saved");
    } catch {
      // Si falla el flush sincronico no podemos reintentar (el modal
      // ya se esta cerrando); el operador puede repetir el cambio en
      // la proxima sesion.
      setPersistenceStatus("error");
    }
  }, []);

  // Flush automatico al CERRAR el modal — evita perder cambios cuando
  // el operador cierra antes de que el debounce se dispare.
  // El effect corre con `open` como dep: al pasar de true→false
  // ejecuta el cleanup que flushea el pending.
  useEffect(() => {
    if (open) return; // Solo nos interesa el cierre.
    void flushSavePending();
  }, [open, flushSavePending]);

  // Cleanup al desmontar — limpia el timer si quedo activo. El flush
  // sincronico ya se hizo en el effect [open] anterior.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const persistAll = useCallback(
    (nextLayout: LayoutV2, nextPresets: NamedLayoutPreset[], nextDefaultId: string | null) => {
      scheduleSave({
        layoutV2: nextLayout,
        savedPresets: nextPresets,
        defaultPresetId: nextDefaultId,
      });
    },
    [scheduleSave],
  );

  // ── API publica ────────────────────────────────────────────────────────────

  const setLayoutV2 = useCallback(
    (next: LayoutV2, opts?: { persist?: boolean }) => {
      setLayoutV2State(next);
      // 2026-05-29 — fix "Error al guardar" fantasma:
      // Solo persistimos cambios user-driven (drag/resize/preset/restore).
      // Los cambios cosméticos del motor de auto-grow/shrink y la
      // compactación interna NO se persisten — son derivables del
      // contenido al re-mount, no representan intención del operador.
      // Sin esto, cada apertura del modal disparaba un PUT por la
      // re-compactación inicial, y si el backend rechazaba el payload
      // (por cualquier razón) el operador veía "Error al guardar" sin
      // haber hecho nada.
      const persist = opts?.persist !== false;
      if (persist) {
        persistAll(next, presets, defaultPresetId);
      }
    },
    [presets, defaultPresetId, persistAll],
  );

  const takeSnapshot = useCallback(() => {
    snapshotRef.current = cloneLayout(layoutV2);
  }, [layoutV2]);

  const restoreSnapshot = useCallback((): LayoutV2 | null => {
    const snap = snapshotRef.current;
    if (!snap) return null;
    const cloned = cloneLayout(snap);
    setLayoutV2State(cloned);
    persistAll(cloned, presets, defaultPresetId);
    snapshotRef.current = null;
    return cloned;
  }, [presets, defaultPresetId, persistAll]);

  const savePresetAs = useCallback(
    (name: string): string => {
      const id = genId();
      const preset: NamedLayoutPreset = {
        id,
        name: name.trim() || "Mi vista",
        layoutV2: cloneLayout(layoutV2),
        createdAt: new Date().toISOString(),
      };
      const next = [...presets, preset];
      setPresets(next);
      persistAll(layoutV2, next, defaultPresetId);
      return id;
    },
    [layoutV2, presets, defaultPresetId, persistAll],
  );

  const applyPreset = useCallback(
    (id: string) => {
      const found = presets.find((p) => p.id === id);
      if (!found) return;
      const cloned = cloneLayout(found.layoutV2);
      setLayoutV2State(cloned);
      persistAll(cloned, presets, defaultPresetId);
    },
    [presets, defaultPresetId, persistAll],
  );

  const renamePreset = useCallback(
    (id: string, name: string) => {
      const next = presets.map((p) =>
        p.id === id ? { ...p, name: name.trim() || p.name } : p,
      );
      setPresets(next);
      persistAll(layoutV2, next, defaultPresetId);
    },
    [presets, defaultPresetId, layoutV2, persistAll],
  );

  const duplicatePreset = useCallback(
    (id: string): string | null => {
      const found = presets.find((p) => p.id === id);
      if (!found) return null;
      const newId = genId();
      const copy: NamedLayoutPreset = {
        ...found,
        id: newId,
        name: `${found.name} (copia)`,
        layoutV2: cloneLayout(found.layoutV2),
        createdAt: new Date().toISOString(),
      };
      const next = [...presets, copy];
      setPresets(next);
      persistAll(layoutV2, next, defaultPresetId);
      return newId;
    },
    [presets, defaultPresetId, layoutV2, persistAll],
  );

  const deletePreset = useCallback(
    (id: string) => {
      const next = presets.filter((p) => p.id !== id);
      const nextDefault = defaultPresetId === id ? null : defaultPresetId;
      setPresets(next);
      setDefaultPresetIdState(nextDefault);
      persistAll(layoutV2, next, nextDefault);
    },
    [presets, defaultPresetId, layoutV2, persistAll],
  );

  const setDefaultPresetId = useCallback(
    (id: string | null) => {
      setDefaultPresetIdState(id);
      persistAll(layoutV2, presets, id);
    },
    [layoutV2, presets, persistAll],
  );

  return useMemo<UseInvoiceLayoutResult>(
    () => ({
      layoutV2,
      setLayoutV2,
      takeSnapshot,
      restoreSnapshot,
      persistenceStatus,
      flushSavePending,
      presets,
      defaultPresetId,
      savePresetAs,
      applyPreset,
      renamePreset,
      duplicatePreset,
      deletePreset,
      setDefaultPresetId,
    }),
    [
      layoutV2, setLayoutV2, takeSnapshot, restoreSnapshot, persistenceStatus,
      flushSavePending, presets, defaultPresetId, savePresetAs, applyPreset,
      renamePreset, duplicatePreset, deletePreset, setDefaultPresetId,
    ],
  );
}
