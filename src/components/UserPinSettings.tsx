// tptech-frontend/src/components/UserPinSettings.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Save } from "lucide-react";

import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { TPSegmentedPills } from "./ui/TPBadges";

type SecuritySettings = {
  quickSwitchEnabled: boolean;
  pinLockEnabled: boolean;
  pinLockTimeoutSec: number;
  pinLockRequireOnUserSwitch: boolean;
};

type Snapshot = {
  quickSwitchEnabled: boolean;
  pinLockEnabled: boolean;
  pinLockRequireOnUserSwitch: boolean;
  timeoutMin: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function friendlyError(e: any, fallback: string) {
  const msg = String(e?.message || "").trim();
  return msg || fallback;
}

export default function UserPinSettings() {
  const auth = useAuth();
  const { canAny } = usePermissions();

  // ✅ permisos consistentes con el resto del sistema
  const canEdit = canAny(["COMPANY_SETTINGS:EDIT", "COMPANY_SETTINGS:ADMIN"]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [quickSwitchEnabled, setQuickSwitchEnabled] = useState(false);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [pinLockRequireOnUserSwitch, setPinLockRequireOnUserSwitch] = useState(false);
  const [timeoutMin, setTimeoutMin] = useState(5);

  const busy = loading || saving;

  // ✅ snapshot para "Cancelar" prolijo (volver a lo cargado, no recargar)
  const snapRef = useRef<Snapshot>({
    quickSwitchEnabled: false,
    pinLockEnabled: false,
    pinLockRequireOnUserSwitch: false,
    timeoutMin: 5,
  });

  // ✅ timer ok autoclear (evita timers colgados si desmonta)
  const okTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
    };
  }, []);

  const timeoutOptions = useMemo(() => [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 240, 360, 720], []);

  const disabledCardClass = !pinLockEnabled ? "opacity-55 bg-surface2/80" : "";
  const requireSwitchDisabled = !pinLockEnabled || !quickSwitchEnabled;

  // ✅ UX: si no aplica, mostramos "No aplica" y forzamos visualmente OFF
  const requireSwitchValue = requireSwitchDisabled ? false : Boolean(pinLockRequireOnUserSwitch);
  const requireSwitchLabels =
    !pinLockEnabled
      ? { off: "No aplica", on: "Requerir" }
      : !quickSwitchEnabled
      ? { off: "No aplica", on: "Requerir" }
      : { off: "No requerir", on: "Requerir" };

  function applySnapshot(s: Snapshot) {
    setQuickSwitchEnabled(Boolean(s.quickSwitchEnabled));
    setPinLockEnabled(Boolean(s.pinLockEnabled));
    setPinLockRequireOnUserSwitch(Boolean(s.pinLockRequireOnUserSwitch));
    setTimeoutMin(clamp(Math.floor(Number(s.timeoutMin) || 1), 1, 720));
  }

  async function load() {
    if (busy) return;

    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const data = await apiFetch<{ security: SecuritySettings }>("/company/settings/security", {
        method: "GET",
        cache: "no-store",
        timeoutMs: 12000,
      });

      const s = data.security;
      const sec = clamp(Math.trunc(Number(s.pinLockTimeoutSec ?? 300)), 10, 60 * 60 * 12);

      const snap: Snapshot = {
        quickSwitchEnabled: Boolean(s.quickSwitchEnabled),
        pinLockEnabled: Boolean(s.pinLockEnabled),
        pinLockRequireOnUserSwitch: Boolean(s.pinLockRequireOnUserSwitch),
        timeoutMin: clamp(Math.round(sec / 60), 1, 720),
      };

      snapRef.current = snap;
      applySnapshot(snap);
    } catch (e: any) {
      setErr(friendlyError(e, "Error cargando configuración."));
    } finally {
      setLoading(false);
    }
  }

  function onCancel() {
    if (busy) return;
    setErr(null);
    setOk(null);
    applySnapshot(snapRef.current);
  }

  async function save() {
    if (!canEdit || busy) return;

    setErr(null);
    setOk(null);
    setSaving(true);

    try {
      const safeTimeoutMin = clamp(Math.floor(Number(timeoutMin) || 1), 1, 720);

      const body: Partial<SecuritySettings> = {
        // ✅ dependencias: si apagan PIN global, apagamos lo demás
        pinLockEnabled: Boolean(pinLockEnabled),
        quickSwitchEnabled: Boolean(pinLockEnabled ? quickSwitchEnabled : false),
        pinLockRequireOnUserSwitch: Boolean(pinLockEnabled && quickSwitchEnabled ? pinLockRequireOnUserSwitch : false),
        pinLockTimeoutSec: safeTimeoutMin * 60,
      };

      await apiFetch("/company/settings/security", {
        method: "PATCH",
        body,
        timeoutMs: 12000,
      });

      setOk("Guardado correctamente");
      await auth.refreshMe({ silent: true });

      // ✅ actualizamos snapshot a lo guardado (para que "Cancelar" no vuelva atrás)
      const nextSnap: Snapshot = {
        pinLockEnabled: Boolean(body.pinLockEnabled),
        quickSwitchEnabled: Boolean(body.quickSwitchEnabled),
        pinLockRequireOnUserSwitch: Boolean(body.pinLockRequireOnUserSwitch),
        timeoutMin: safeTimeoutMin,
      };

      snapRef.current = nextSnap;
      applySnapshot(nextSnap);

      if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
      okTimerRef.current = window.setTimeout(() => {
        setOk(null);
        okTimerRef.current = null;
      }, 2500);
    } catch (e: any) {
      setErr(friendlyError(e, "Error guardando configuración."));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tp-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">Seguridad (PIN / Quick Switch)</div>
            <div className="text-xs text-muted">Configuración por joyería</div>
          </div>
        </div>

        <button
          type="button"
          className={cn("h-9 px-3 rounded-xl border border-border bg-card text-sm", busy && "opacity-60 pointer-events-none")}
          onClick={() => void load()}
        >
          Recargar
        </button>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Solo lectura. No tenés permisos para modificar esta configuración.
        </div>
      )}

      {(err || ok) && (
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-sm border",
            err ? "text-red-400 bg-red-500/10 border-red-500/15" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/15"
          )}
        >
          {err || ok}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* PIN Lock (principal) */}
        <div className="tp-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Bloqueo por PIN</div>
              <div className="text-xs text-muted mt-1">Bloquea por inactividad</div>
            </div>

            <TPSegmentedPills
              value={pinLockEnabled}
              onChange={(v) => {
                if (!canEdit || busy) return;
                setErr(null);
                setOk(null);

                const next = Boolean(v);
                setPinLockEnabled(next);

                // ✅ dependencias
                if (!next) {
                  setQuickSwitchEnabled(false);
                  setPinLockRequireOnUserSwitch(false);
                }
              }}
              disabled={!canEdit || busy}
              labels={{ off: "Deshabilitado", on: "Habilitado" }}
              size="sm"
            />
          </div>
        </div>

        {/* Quick Switch */}
        <div className={`tp-card p-4 transition ${disabledCardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Cambio rápido de usuario</div>
              <div className="text-xs text-muted mt-1">Permite cambiar de usuario desde la pantalla bloqueada.</div>
            </div>

            <TPSegmentedPills
              value={quickSwitchEnabled}
              onChange={(v) => {
                if (!canEdit || busy || !pinLockEnabled) return;
                setErr(null);
                setOk(null);

                const next = Boolean(v);
                setQuickSwitchEnabled(next);

                // ✅ si lo apagan, no aplica exigir PIN
                if (!next) setPinLockRequireOnUserSwitch(false);
              }}
              disabled={!canEdit || busy || !pinLockEnabled}
              labels={{ off: "Deshabilitado", on: "Habilitado" }}
              size="sm"
            />
          </div>
        </div>

        {/* Require PIN on switch */}
        <div className={`tp-card p-4 transition ${disabledCardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Requerir PIN al cambiar usuario</div>
              <div className="text-xs text-muted mt-1">Exige PIN cuando se usa el cambio rápido.</div>
            </div>

            <TPSegmentedPills
              value={requireSwitchValue}
              onChange={(v) => {
                if (!canEdit || busy || requireSwitchDisabled) return;
                setErr(null);
                setOk(null);
                setPinLockRequireOnUserSwitch(Boolean(v));
              }}
              disabled={!canEdit || busy || requireSwitchDisabled}
              labels={requireSwitchLabels}
              size="sm"
            />
          </div>

          {pinLockEnabled && !quickSwitchEnabled && (
            <div className="mt-2 text-[11px] text-muted">
              <b>No aplica:</b> activá “Cambio rápido de usuario” para poder exigir PIN al cambiar usuario.
            </div>
          )}

          {!pinLockEnabled && (
            <div className="mt-2 text-[11px] text-muted">
              <b>No aplica:</b> primero habilitá el “Bloqueo por PIN”.
            </div>
          )}
        </div>

        {/* Timeout */}
        <div className={`tp-card p-4 transition ${disabledCardClass} md:col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text">Tiempo de inactividad</div>
              <div className="text-xs text-muted">Minutos para bloquear</div>
            </div>
            <div className="text-sm font-semibold text-text">{timeoutMin} min</div>
          </div>

          <select
            className={cn("tp-input w-full mt-2", (!canEdit || !pinLockEnabled || busy) && "opacity-60 pointer-events-none")}
            value={timeoutMin}
            onChange={(e) => {
              setErr(null);
              setOk(null);
              setTimeoutMin(clamp(Number(e.target.value), 1, 720));
            }}
          >
            {timeoutOptions.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>

          <div className="text-[11px] text-muted mt-2">Recomendado: 1 a 720 minutos.</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className={cn("h-10 px-4 rounded-xl border border-border bg-card text-sm", busy && "opacity-60")}
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </button>

        <button
          type="button"
          className={cn("tp-btn-primary inline-flex items-center justify-center gap-2", (!canEdit || busy) && "opacity-60 pointer-events-none")}
          onClick={() => void save()}
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
