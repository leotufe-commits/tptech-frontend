// tptech-frontend/src/pages/SystemPinSettings.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { KeyRound, Save, X, Users, ArrowRight, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TPSegmentedPills } from "../components/ui/TPBadges";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Snapshot = {
  enabled: boolean;
  timeoutMin: number;
  quickSwitchEnabled: boolean;
  requireOnSwitch: boolean;
};

const PINLOCK_PENDING_KEY = "tptech_pinlock_pending_enable_v1";

export default function SystemPinSettings() {
  const auth = useAuth();
  const navigate = useNavigate();

  // ✅ Ruta real de Usuarios en TU app
  const USERS_ROUTE = "/configuracion/usuarios";

  const canEdit = useMemo(() => {
    const perms = auth.permissions ?? [];
    return (
      perms.includes("COMPANY_SETTINGS:ADMIN") ||
      perms.includes("COMPANY_SETTINGS:EDIT") ||
      perms.includes("USERS_ROLES:ADMIN")
    );
  }, [auth.permissions]);

  // ✅ state local (UI)
  const [enabled, setEnabled] = useState<boolean>(Boolean(auth.pinLockEnabled));
  const [timeoutMin, setTimeoutMin] = useState<number>(Number(auth.pinLockTimeoutMinutes || 5));
  const [quickSwitchEnabled, setQuickSwitchEnabled] = useState<boolean>(Boolean(auth.quickSwitchEnabled));
  const [requireOnSwitch, setRequireOnSwitch] = useState<boolean>(Boolean(auth.pinLockRequireOnUserSwitch));

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ✅ confirmación “salir a Usuarios con cambios”
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  // ✅ modal: “no podés activar lock sin PIN”
  const [showNeedPinConfirm, setShowNeedPinConfirm] = useState(false);

  const savedTimerRef = useRef<number | null>(null);

  // snapshot “server”
  const serverSnapRef = useRef<Snapshot>({
    enabled: Boolean(auth.pinLockEnabled),
    timeoutMin: clamp(Math.floor(Number(auth.pinLockTimeoutMinutes || 5)), 1, 60 * 12),
    quickSwitchEnabled: Boolean(auth.quickSwitchEnabled),
    requireOnSwitch: Boolean(auth.pinLockRequireOnUserSwitch),
  });

  function clearSavedTimer() {
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }

  function computeServerSnapshot(): Snapshot {
    return {
      enabled: Boolean(auth.pinLockEnabled),
      timeoutMin: clamp(Math.floor(Number(auth.pinLockTimeoutMinutes || 5)), 1, 60 * 12),
      quickSwitchEnabled: Boolean(auth.quickSwitchEnabled),
      requireOnSwitch: Boolean(auth.pinLockRequireOnUserSwitch),
    };
  }

  function computeDirty(next?: Partial<Snapshot>) {
    const base = serverSnapRef.current;
    const cur: Snapshot = {
      enabled: next?.enabled ?? Boolean(enabled),
      timeoutMin: next?.timeoutMin ?? clamp(Math.floor(Number(timeoutMin || 1)), 1, 60 * 12),
      quickSwitchEnabled: next?.quickSwitchEnabled ?? Boolean(quickSwitchEnabled),
      requireOnSwitch: next?.requireOnSwitch ?? Boolean(requireOnSwitch),
    };

    return (
      cur.enabled !== base.enabled ||
      cur.timeoutMin !== base.timeoutMin ||
      cur.quickSwitchEnabled !== base.quickSwitchEnabled ||
      cur.requireOnSwitch !== base.requireOnSwitch
    );
  }

  const dirty = useMemo(() => computeDirty(), [enabled, timeoutMin, quickSwitchEnabled, requireOnSwitch]);

  function resetToServerValues() {
    const snap = computeServerSnapshot();
    serverSnapRef.current = snap;

    setEnabled(snap.enabled);
    setTimeoutMin(snap.timeoutMin);
    setQuickSwitchEnabled(snap.quickSwitchEnabled);
    setRequireOnSwitch(snap.requireOnSwitch);

    setErr(null);
    setSaved(null);
    setShowLeaveConfirm(false);
    setLeaveBusy(false);
    setShowNeedPinConfirm(false);
  }

  // ✅ sincroniza cuando cambia el "server snapshot" (AuthContext)
  useEffect(() => {
    resetToServerValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    auth.pinLockEnabled,
    auth.pinLockTimeoutMinutes,
    auth.pinLockRequireOnUserSwitch,
    auth.quickSwitchEnabled,
  ]);

  // ✅ cleanup timers on unmount
  useEffect(() => {
    return () => clearSavedTimer();
  }, []);

  /** ✅ Heurística tolerante para detectar si MI usuario tiene PIN */
  const meId = String((auth.user as any)?.id || "");
  const meHasQuickPin = useMemo(() => {
    const u: any = auth.user || {};
    if (typeof u.hasQuickPin === "boolean") return u.hasQuickPin;
    if (typeof u.quickPinEnabled === "boolean") return u.quickPinEnabled;
    if (typeof u.pinEnabled === "boolean") return u.pinEnabled;
    if (u.quickPinHash) return true;
    if (u.pinHash) return true;
    return false;
  }, [auth.user]);

  function goToMyUserPinSetup() {
    // ✅ ruta: abrir edición + tab=config + abrir flujo PIN + volver
    if (!meId) {
      navigate(USERS_ROUTE);
      return;
    }
    const qs = new URLSearchParams();
    qs.set("edit", meId);
    qs.set("tab", "config");
    qs.set("pin", "setup");
    qs.set("return", "/configuracion-sistema/pin");
    navigate(`${USERS_ROUTE}?${qs.toString()}`);
  }

  function setPendingEnableSnapshot() {
    try {
      const safeMin = clamp(Math.floor(Number(timeoutMin) || 1), 1, 60 * 12);
      const payload = {
        enabled: true,
        timeoutMinutes: safeMin,
        requireOnUserSwitch: Boolean(requireOnSwitch),
        quickSwitchEnabled: Boolean(quickSwitchEnabled),
        at: Date.now(),
      };
      sessionStorage.setItem(PINLOCK_PENDING_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  function clearPendingEnable() {
    try {
      sessionStorage.removeItem(PINLOCK_PENDING_KEY);
    } catch {
      // ignore
    }
  }

  async function onSave(): Promise<boolean> {
    if (!canEdit || busy) return false;

    setErr(null);
    setSaved(null);
    clearSavedTimer();

    const safeMin = clamp(Math.floor(Number(timeoutMin) || 1), 1, 60 * 12);

    // ✅ BLOQUEO DURO: no permitir guardar enabled=true si el usuario actual no tiene PIN
    if (Boolean(enabled) && !meHasQuickPin) {
      setErr("No podés activar el bloqueo por PIN si tu usuario no tiene un PIN configurado. Crealo primero.");
      setShowNeedPinConfirm(true);
      return false;
    }

    setBusy(true);
    try {
      const payload = {
        enabled: Boolean(enabled),
        timeoutMinutes: safeMin,
        requireOnUserSwitch: Boolean(requireOnSwitch),
        quickSwitchEnabled: Boolean(quickSwitchEnabled),
      };

      await auth.setPinLockSettingsForJewelry(payload);

      serverSnapRef.current = {
        enabled: payload.enabled,
        timeoutMin: payload.timeoutMinutes,
        quickSwitchEnabled: payload.quickSwitchEnabled,
        requireOnSwitch: payload.requireOnUserSwitch,
      };

      setSaved("Guardado.");
      savedTimerRef.current = window.setTimeout(() => setSaved(null), 2500);
      return true;
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ✅ AUTO: si venimos de crear PIN, y ahora meHasQuickPin=true, re-habilitar + guardar
  useEffect(() => {
    if (!canEdit) return;

    let raw: any = null;
    try {
      const s = sessionStorage.getItem(PINLOCK_PENDING_KEY);
      raw = s ? JSON.parse(s) : null;
    } catch {
      raw = null;
    }

    if (!raw) return;

    // si todavía no hay PIN, no hacemos nada (pero limpiamos si querés)
    if (!meHasQuickPin) return;

    // aplicar y guardar una sola vez
    clearPendingEnable();

    setEnabled(true);
    setQuickSwitchEnabled(Boolean(raw.quickSwitchEnabled));
    setRequireOnSwitch(Boolean(raw.requireOnUserSwitch));
    setTimeoutMin(clamp(Number(raw.timeoutMinutes || 5), 1, 720));

    // guardado automático (sin pedir al usuario)
    void (async () => {
      try {
        await onSave();
      } catch {
        // si falla, dejamos UI en estado aplicado pero mostramos err
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meHasQuickPin, canEdit]);

  function onCancel() {
    if (busy) return;
    clearSavedTimer();
    resetToServerValues();
    navigate(-1);
  }

  function goUsersNow() {
    // ✅ botón “Ir a Usuarios”: abrir mi usuario en Config (sin forzar pin setup)
    if (!meId) return navigate(USERS_ROUTE);

    const qs = new URLSearchParams();
    qs.set("edit", meId);
    qs.set("tab", "config");
    qs.set("return", "/configuracion-sistema/pin");
    navigate(`${USERS_ROUTE}?${qs.toString()}`);
  }

  function onGoUsers() {
    if (busy) return;

    if (dirty) {
      setShowLeaveConfirm(true);
      return;
    }

    goUsersNow();
  }

  async function onConfirmSaveAndGo() {
    if (leaveBusy || busy) return;

    if (!canEdit) {
      setShowLeaveConfirm(false);
      goUsersNow();
      return;
    }

    setLeaveBusy(true);
    try {
      const ok = await onSave();
      if (ok) {
        setShowLeaveConfirm(false);
        goUsersNow();
      }
    } finally {
      setLeaveBusy(false);
    }
  }

  const disabledCardClass = !enabled ? "opacity-55 bg-surface2/80" : "";
  const requireSwitchDisabled = !enabled || !quickSwitchEnabled;

  const requireSwitchValue = requireSwitchDisabled ? false : Boolean(requireOnSwitch);
  const requireSwitchLabels =
    !enabled
      ? { off: "No aplica", on: "Requerir" }
      : !quickSwitchEnabled
      ? { off: "No aplica", on: "Requerir" }
      : { off: "No requerir", on: "Requerir" };

  return (
    <div className="p-6 space-y-5">
      {/* ✅ Modal: no permitir activar lock sin PIN propio */}
      {showNeedPinConfirm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setShowNeedPinConfirm(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface2 text-primary">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-text">Falta tu PIN</div>
                <div className="mt-1 text-sm text-muted">
                  Para evitar quedarte encerrado en la pantalla de bloqueo, antes de activar el{" "}
                  <b>Bloqueo por PIN</b> necesitás configurar el PIN de tu usuario.
                </div>
                <div className="mt-2 text-xs text-muted">
                  Ruta: <b>Usuarios → Editar tu usuario → Clave rápida (PIN)</b>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowNeedPinConfirm(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2 text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  // ✅ forzamos OFF visualmente (si cancela PIN, queda deshabilitado)
                  setEnabled(false);
                  setQuickSwitchEnabled(false);
                  setRequireOnSwitch(false);

                  // ✅ dejamos “pendiente” para auto-habilitar al volver si completa PIN
                  setPendingEnableSnapshot();

                  setShowNeedPinConfirm(false);
                  goToMyUserPinSetup();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-primary hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
              >
                <Users className="h-4 w-4" />
                Configurar mi PIN
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal confirmación “cambios sin guardar” */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !leaveBusy && setShowLeaveConfirm(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-surface2 text-primary">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="text-base font-semibold text-text">Cambios sin guardar</div>
                <div className="mt-1 text-sm text-muted">
                  Tenés cambios en la configuración del PIN. ¿Querés guardarlos antes de ir a Usuarios?
                </div>

                {!canEdit && (
                  <div className="mt-2 text-xs text-amber-700 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    No tenés permisos para guardar. Podés ir a Usuarios, pero tus cambios no se aplicarán.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={leaveBusy}
                onClick={() => setShowLeaveConfirm(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2 text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>

              <button
                type="button"
                disabled={leaveBusy}
                onClick={() => {
                  setShowLeaveConfirm(false);
                  goUsersNow();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
              >
                Ir sin guardar
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={leaveBusy || busy || !canEdit}
                onClick={() => void onConfirmSaveAndGo()}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white",
                  "bg-primary hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                  (!canEdit || leaveBusy || busy) && "opacity-60 cursor-not-allowed"
                )}
                title={!canEdit ? "No tenés permisos para guardar" : "Guardar y ir"}
              >
                <Save className="h-4 w-4" />
                {leaveBusy ? "Guardando…" : "Guardar e ir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-border bg-card grid place-items-center">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-text">Configurar PIN</div>
          <div className="text-sm text-muted">Bloqueo automático y políticas del sistema.</div>
        </div>
      </div>

      <div className="tp-card p-4 space-y-4">
        <div className="min-w-0">
          <div className="font-semibold text-text">Seguridad (PIN / Quick Switch)</div>
          <div className="text-sm text-muted">Configuración por joyería.</div>
        </div>

        {!canEdit && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            Solo lectura. No tenés permisos para modificar esta configuración.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="tp-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Bloqueo por PIN</div>
                <div className="text-xs text-muted mt-1">Bloquea por inactividad</div>
              </div>

              <TPSegmentedPills
                value={enabled}
                onChange={(v) => {
                  if (!canEdit || busy) return;

                  setErr(null);
                  setSaved(null);
                  clearSavedTimer();

                  if (!v) {
                    setEnabled(false);
                    setQuickSwitchEnabled(false);
                    setRequireOnSwitch(false);
                    // si apaga manualmente, limpiamos pendiente
                    try {
                      sessionStorage.removeItem(PINLOCK_PENDING_KEY);
                    } catch {}
                    return;
                  }

                  if (!meHasQuickPin) {
                    setEnabled(false);
                    setQuickSwitchEnabled(false);
                    setRequireOnSwitch(false);
                    setShowNeedPinConfirm(true);
                    return;
                  }

                  setEnabled(true);
                }}
                disabled={!canEdit || busy}
                labels={{ off: "Deshabilitado", on: "Habilitado" }}
                size="sm"
              />
            </div>

            {!meHasQuickPin ? (
              <div className="mt-3 text-[11px] text-muted">
                Para activar el bloqueo por PIN, primero configurá <b>tu</b> PIN en Usuarios.
              </div>
            ) : null}
          </div>

          <div className={`tp-card p-4 transition ${disabledCardClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">Cambio rápido de usuario</div>
                <div className="text-xs text-muted mt-1">Permite cambiar de usuario desde la pantalla bloqueada.</div>
              </div>

              <TPSegmentedPills
                value={quickSwitchEnabled}
                onChange={(v) => {
                  if (!canEdit || busy || !enabled) return;

                  setErr(null);
                  setSaved(null);
                  clearSavedTimer();

                  setQuickSwitchEnabled(Boolean(v));
                  if (!v) setRequireOnSwitch(false);
                }}
                disabled={!canEdit || busy || !enabled}
                labels={{ off: "Deshabilitado", on: "Habilitado" }}
                size="sm"
              />
            </div>
          </div>

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
                  setSaved(null);
                  clearSavedTimer();
                  setRequireOnSwitch(Boolean(v));
                }}
                disabled={!canEdit || busy || requireSwitchDisabled}
                labels={requireSwitchLabels}
                size="sm"
              />
            </div>

            {enabled && !quickSwitchEnabled && (
              <div className="mt-2 text-[11px] text-muted">
                Esta opción aplica solo si “Cambio rápido de usuario” está habilitado.
              </div>
            )}
          </div>

          <div className={`tp-card p-4 transition ${disabledCardClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text">Tiempo de inactividad</div>
                <div className="text-xs text-muted">Minutos para bloquear</div>
              </div>
              <div className="text-sm font-semibold text-text">{timeoutMin} min</div>
            </div>

            <input
              className={cn("tp-input w-full mt-2", (!canEdit || busy || !enabled) && "opacity-60")}
              type="number"
              min={1}
              max={720}
              value={timeoutMin}
              disabled={!canEdit || busy || !enabled}
              onChange={(e) => {
                const next = clamp(Number(e.target.value || 1), 1, 720);
                setErr(null);
                setSaved(null);
                clearSavedTimer();
                setTimeoutMin(next);
              }}
            />

            <div className="text-[11px] text-muted mt-2">Recomendado: 1 a 720 minutos.</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface2/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Importante</div>
              <div className="mt-1 text-sm text-muted">
                El PIN se configura en <b>2 niveles</b>: <b>Joyería</b> (este panel) y <b>Usuario</b>.
                Aunque actives el PIN acá, cada usuario debe tener el PIN habilitado en su perfil.
              </div>
              <div className="mt-2 text-xs text-muted">
                Ruta sugerida: <b>Usuarios → Editar usuario → PIN</b>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
              onClick={onGoUsers}
              disabled={busy}
              title={dirty ? "Tenés cambios sin guardar" : "Ir a Usuarios"}
            >
              <Users className="h-4 w-4" />
              Ir a Usuarios
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(err || saved) && (
          <div
            className={cn(
              "text-sm rounded-xl px-3 py-2 border",
              err
                ? "text-red-400 bg-red-500/10 border-red-500/15"
                : "text-emerald-400 bg-emerald-500/10 border-emerald-500/15"
            )}
          >
            {err || saved}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2 text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>

          <button
            type="button"
            className="tp-btn-primary inline-flex items-center justify-center gap-2"
            disabled={!canEdit || busy}
            onClick={() => void onSave()}
            title={dirty ? "Guardar cambios" : "Guardar"}
          >
            <Save className="h-4 w-4" />
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
