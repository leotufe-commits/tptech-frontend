// tptech-frontend/src/components/LockScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Lock, User2 } from "lucide-react";
import { useAuth, type QuickUser } from "../context/AuthContext";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function maskEmail(email: string) {
  const e = String(email || "");
  const [u, d] = e.split("@");
  if (!d) return e;
  if (u.length <= 2) return `${u[0] ?? ""}*@${d}`;
  return `${u.slice(0, 2)}***@${d}`;
}

function getErrorMessage(e: unknown, fallback = "PIN incorrecto.") {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || fallback;
  const maybe = e as { message?: unknown };
  if (typeof maybe?.message === "string") return maybe.message;
  return fallback;
}

export default function LockScreen() {
  const auth = useAuth();
  const { locked, setLocked, user, quickSwitchEnabled } = auth;

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<QuickUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const didLoadRef = useRef(false);

  const meId = user?.id ?? null;

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((u) => u.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  const effectiveSelectedUserId = selectedUserId ?? meId;

  useEffect(() => {
    if (!locked) return;

    setPin("");
    setError(null);
    setSubmitting(false);

    setSelectedUserId(meId);
    didLoadRef.current = false;
  }, [locked, meId]);

  useEffect(() => {
    if (!locked) return;
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    const run = async () => {
      try {
        if (!quickSwitchEnabled) {
          // modo simple: solo el usuario actual
          setUsers(
            user
              ? [
                  {
                    id: user.id,
                    email: user.email,
                    name: user.name ?? null,
                    avatarUrl: user.avatarUrl ?? null,
                    hasQuickPin: true,
                    pinEnabled: true,
                  },
                ]
              : []
          );
          setSelectedUserId(user?.id ?? null);
          return;
        }

        setLoadingUsers(true);
        const data = await auth.pinQuickUsers();

        if (data.enabled) {
          const list = data.users ?? [];
          setUsers(list);
          const mine = list.find((u) => u.id === meId);
          setSelectedUserId(mine ? mine.id : (list[0]?.id ?? null));
        } else {
          setUsers(
            user
              ? [
                  {
                    id: user.id,
                    email: user.email,
                    name: user.name ?? null,
                    avatarUrl: user.avatarUrl ?? null,
                    hasQuickPin: true,
                    pinEnabled: true,
                  },
                ]
              : []
          );
          setSelectedUserId(user?.id ?? null);
        }
      } catch {
        setUsers(
          user
            ? [
                {
                  id: user.id,
                  email: user.email,
                  name: user.name ?? null,
                  avatarUrl: user.avatarUrl ?? null,
                  hasQuickPin: true,
                  pinEnabled: true,
                },
              ]
            : []
        );
        setSelectedUserId(user?.id ?? null);
      } finally {
        setLoadingUsers(false);
      }
    };

    void run();
  }, [locked, quickSwitchEnabled, auth, user, meId]);

  const addDigit = useCallback(
    (d: string) => {
      if (submitting) return;
      setError(null);
      setPin((p) => (p.length < 4 ? p + d : p));
    },
    [submitting]
  );

  const delDigit = useCallback(() => {
    if (submitting) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }, [submitting]);

  const clearPin = useCallback(() => {
    if (submitting) return;
    setError(null);
    setPin("");
  }, [submitting]);

  const submit = useCallback(async () => {
    if (submitting) return;

    setError(null);

    const targetId = effectiveSelectedUserId;
    if (!targetId) {
      setError("No hay usuario seleccionado.");
      return;
    }

    if (pin.length !== 4) {
      setError("Ingresá tu PIN de 4 dígitos.");
      return;
    }

    setSubmitting(true);
    try {
      if (meId && targetId === meId) {
        await auth.pinUnlock(pin);
        setLocked(false);
        return;
      }

      // ✅ backend espera pin4
      await auth.pinSwitchUser({ targetUserId: targetId, pin4: pin });
      setLocked(false);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "PIN incorrecto."));
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }, [auth, effectiveSelectedUserId, meId, pin, setLocked, submitting]);

  useEffect(() => {
    if (!locked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        delDigit();
        return;
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        addDigit(e.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, submit, delDigit, addDigit]);

  if (!locked) return null;

  const titleUser = selectedUser ?? (users.find((u) => u.id === meId) ?? null);

  return (
    <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative mx-auto flex h-full w-full max-w-[1100px] items-center justify-center px-4">
        <div className="w-full overflow-hidden rounded-3xl border border-border bg-bg shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px]">
            {/* LEFT */}
            <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted">
                    <Lock className="h-4 w-4" />
                    Pantalla bloqueada
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-text">Ingresá con tu PIN</div>
                  <div className="mt-1 text-sm text-muted">
                    {quickSwitchEnabled
                      ? "Elegí tu usuario y colocá tu PIN."
                      : "Solo desbloqueo del usuario actual."}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold text-text">Usuarios</div>

                <div className="rounded-2xl border border-border bg-card p-3">
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando usuarios…
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-3 text-sm text-muted">No hay usuarios disponibles.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {users.map((u) => {
                        const active = u.id === selectedUserId;
                        const disabled = quickSwitchEnabled
                          ? !(u.hasQuickPin && u.pinEnabled)
                          : u.id !== meId;

                        return (
                          <button
                            key={u.id}
                            type="button"
                            disabled={disabled || submitting}
                            onClick={() => {
                              setError(null);
                              setPin("");
                              setSelectedUserId(u.id);
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                              disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface2",
                              active ? "border-border bg-surface2" : "border-transparent bg-bg"
                            )}
                          >
                            <div className="h-11 w-11 overflow-hidden rounded-full border border-border bg-card">
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt="Avatar"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                                  {(u.name || u.email || "U").charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-text">
                                {u.name || u.email}
                              </div>
                              <div className="truncate text-xs text-muted">{maskEmail(u.email)}</div>

                              {quickSwitchEnabled && !u.hasQuickPin && (
                                <div className="mt-1 text-[11px] font-semibold text-muted">
                                  Sin PIN configurado
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-muted">
                  Tip: el administrador puede habilitar/deshabilitar el cambio rápido por empresa.
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted">
                <User2 className="h-4 w-4" />
                {titleUser?.name || titleUser?.email || "Usuario"}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                {[0, 1, 2, 3].map((i) => {
                  const filled = Boolean(pin[i]);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "h-4 w-4 rounded-full border",
                        filled ? "bg-primary border-primary" : "border-border bg-bg"
                      )}
                    />
                  );
                })}
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-text">
                  {error}
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => addDigit(d)}
                    disabled={submitting}
                    className="h-14 rounded-2xl border border-border bg-card text-lg font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    {d}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={clearPin}
                  disabled={submitting}
                  className="h-14 rounded-2xl border border-border bg-card text-sm font-semibold text-muted hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  Limpiar
                </button>

                <button
                  type="button"
                  onClick={() => addDigit("0")}
                  disabled={submitting}
                  className="h-14 rounded-2xl border border-border bg-card text-lg font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={delDigit}
                  disabled={submitting}
                  className="h-14 rounded-2xl border border-border bg-card text-sm font-semibold text-muted hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  Borrar
                </button>
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || pin.length !== 4}
                className={cn(
                  "mt-4 h-14 w-full rounded-2xl border border-border text-sm font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
                  submitting || pin.length !== 4
                    ? "bg-card text-muted opacity-60"
                    : "bg-surface2 text-text hover:bg-card",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                )}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando…
                  </span>
                ) : meId && effectiveSelectedUserId === meId ? (
                  "Desbloquear"
                ) : (
                  "Entrar"
                )}
              </button>

              <div className="mt-3 text-xs text-muted">Enter = confirmar • Backspace = borrar</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
