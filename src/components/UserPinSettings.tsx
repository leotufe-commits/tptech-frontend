// tptech-frontend/src/components/UserPinSettings.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { TPSegmentedPills } from "./ui/TPBadges";
import { KeyRound, Save } from "lucide-react";

type SecuritySettings = {
  quickSwitchEnabled: boolean;
  pinLockEnabled: boolean;
  pinLockTimeoutSec: number;
  pinLockRequireOnUserSwitch: boolean;
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

  const timeoutOptions = useMemo(
    () => [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120],
    []
  );

  const disabledCardClass = !pinLockEnabled ? "opacity-55 bg-surface2/80" : "";
  const requireSwitchDisabled = !pinLockEnabled || !quickSwitchEnabled;

  async function load() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ security: SecuritySettings }>(
        "/company/settings/security",
        {
          method: "GET",
          cache: "no-store",
          timeoutMs: 12000,
        }
      );

      const s = data.security;

      const sec = clamp(Math.trunc(Number(s.pinLockTimeoutSec ?? 300)), 10, 60 * 60 * 12);

      setQuickSwitchEnabled(Boolean(s.quickSwitchEnabled));
      setPinLockEnabled(Boolean(s.pinLockEnabled));
      setPinLockRequireOnUserSwitch(Boolean(s.pinLockRequireOnUserSwitch));
      setTimeoutMin(clamp(Math.round(sec / 60), 1, 720));
    } catch (e: any) {
      setErr(friendlyError(e, "Error cargando configuración."));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!canEdit) return;

    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const body: Partial<SecuritySettings> = {
        quickSwitchEnabled: Boolean(quickSwitchEnabled),
        pinLockEnabled: Boolean(pinLockEnabled),
        pinLockRequireOnUserSwitch: Boolean(pinLockRequireOnUserSwitch),
        pinLockTimeoutSec: clamp(Math.floor(Number(timeoutMin) || 1), 1, 720) * 60,
      };

      await apiFetch("/company/settings/security", {
        method: "PATCH",
        body,
        timeoutMs: 12000,
      });

      setOk("Guardado correctamente");
      await auth.refreshMe({ silent: true });
    } catch (e: any) {
      setErr(friendlyError(e, "Error guardando configuración."));
    } finally {
      setSaving(false);
      window.setTimeout(() => setOk(null), 2500);
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
            <div className="text-sm font-semibold text-text">
              Seguridad (PIN / Quick Switch)
            </div>
            <div className="text-xs text-muted">Configuración por joyería</div>
          </div>
        </div>

        <button
          type="button"
          className={cn(
            "h-9 px-3 rounded-xl border border-border bg-card text-sm",
            (loading || saving) && "opacity-60 pointer-events-none"
          )}
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
            err
              ? "text-red-400 bg-red-500/10 border-red-500/15"
              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/15"
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
                if (!canEdit || loading || saving) return;
                setErr(null);
                setOk(null);
                setPinLockEnabled(Boolean(v));
              }}
              disabled={!canEdit || loading || saving}
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
              <div className="text-xs text-muted mt-1">
                Permite cambiar de usuario desde la pantalla bloqueada.
              </div>
            </div>

            <TPSegmentedPills
              value={quickSwitchEnabled}
              onChange={(v) => {
                if (!canEdit || loading || saving || !pinLockEnabled) return;
                setErr(null);
                setOk(null);
                setQuickSwitchEnabled(Boolean(v));
              }}
              disabled={!canEdit || loading || saving || !pinLockEnabled}
              labels={{ off: "Deshabilitado", on: "Habilitado" }}
              size="sm"
            />
          </div>
        </div>

        {/* Require PIN on switch */}
        <div className={`tp-card p-4 transition ${disabledCardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">
                Requerir PIN al cambiar usuario
              </div>
              <div className="text-xs text-muted mt-1">
                Exige PIN cuando se usa el cambio rápido.
              </div>
            </div>

            <TPSegmentedPills
              value={pinLockRequireOnUserSwitch}
              onChange={(v) => {
                if (!canEdit || loading || saving || requireSwitchDisabled) return;
                setErr(null);
                setOk(null);
                setPinLockRequireOnUserSwitch(Boolean(v));
              }}
              disabled={!canEdit || loading || saving || requireSwitchDisabled}
              labels={{ off: "No requerir", on: "Requerir" }}
              size="sm"
            />
          </div>

          {!quickSwitchEnabled && pinLockEnabled && (
            <div className="mt-2 text-[11px] text-muted">
              Esta opción aplica solo si “Cambio rápido de usuario” está habilitado.
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
            className={cn(
              "tp-input w-full mt-2",
              (!canEdit || !pinLockEnabled || loading || saving) &&
                "opacity-60 pointer-events-none"
            )}
            value={timeoutMin}
            onChange={(e) => setTimeoutMin(clamp(Number(e.target.value), 1, 720))}
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
          className={cn(
            "h-10 px-4 rounded-xl border border-border bg-card text-sm",
            (loading || saving) && "opacity-60 pointer-events-none"
          )}
          onClick={() => void load()}
        >
          Cancelar
        </button>

        <button
          type="button"
          className={cn(
            "tp-btn-primary inline-flex items-center justify-center gap-2",
            (!canEdit || loading || saving) && "opacity-60 pointer-events-none"
          )}
          onClick={() => void save()}
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
