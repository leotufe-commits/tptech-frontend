// tptech-frontend/src/pages/Login.tsx
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as API from "../lib/api"; // ✅ evita el error de export faltante
import { useAuth } from "../context/AuthContext";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {!open && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ✅ flecha “select”
function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type TenantOption = { id: string; name: string };
type LoginOptionsResponse = { email: string; tenants: TenantOption[] };

// (por si /auth/login devuelve token)
type LoginResponseMaybe = { token?: string; accessToken?: string } & Record<string, any>;

function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

// ✅ fallback local si no existe storeTokenAndEmitLogin exportado
function storeTokenAndEmitLoginFallback(token: string) {
  const LS_TOKEN_KEY = (API as any).LS_TOKEN_KEY || "tptech_token";
  const SS_TOKEN_KEY = (API as any).SS_TOKEN_KEY || "tptech_access_token";

  try {
    // preferimos sessionStorage (más seguro) y dejamos legacy en localStorage
    sessionStorage.setItem(SS_TOKEN_KEY, token);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(LS_TOKEN_KEY, token);
  } catch {
    // ignore
  }

  // evento multi-tab
  try {
    (API as any).emitLogin?.();
  } catch {
    // ignore
  }
}

function getErrMessage(err: any, fallback: string) {
  const data = err?.data;
  if (data && typeof data === "object" && typeof (data as any).message === "string" && (data as any).message.trim()) {
    return String((data as any).message).trim();
  }
  const msg = String(err?.message || "").trim();
  return msg || fallback;
}

export default function Login() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  // ✅ Wrapper tipado para evitar TS2347 (genéricos sobre any)
  const apiFetch = (API as any).apiFetch as (<T = any>(path: string, opts?: any) => Promise<T>);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  // ✅ opciones por email
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState<string>("");

  // ✅ fallback manual (si no se encuentran joyerías o falla options)
  const [manualTenantId, setManualTenantId] = useState<string>("");

  const [loadingTenants, setLoadingTenants] = useState(false);

  // ✅ FIX parpadeo: solo mostramos UI de joyería cuando ya hicimos al menos 1 lookup
  const [didLookup, setDidLookup] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const hasEmail = email.trim().length > 0;
  const hasPass = pass.trim().length > 0;

  const lastLookupEmailRef = useRef<string>("");

  // clave para “última joyería usada” por email
  const lastTenantKey = useMemo(() => {
    const e = email.trim().toLowerCase();
    return e ? `tptech_last_tenant_for_email:${e}` : "";
  }, [email]);

  const showTenantSelect = useMemo(() => tenants.length > 1, [tenants.length]);

  // ✅ mostramos fallback manual SOLO cuando ya intentamos lookup
  const showManualTenantInput = useMemo(() => {
    return Boolean(didLookup && emailOk && !loadingTenants && tenants.length === 0);
  }, [didLookup, emailOk, loadingTenants, tenants.length]);

  // ✅ tenant efectivo: si hay 1 sola → usar directo (sin esperar setTenantId)
  const effectiveTenantId = useMemo(() => {
    if (tenants.length === 1) return String(tenants[0]?.id || "").trim();
    if (tenants.length > 1) return tenantId.trim();
    return manualTenantId.trim();
  }, [tenants, tenantId, manualTenantId]);

  // ✅ buscar joyerías asociadas al email (debounce)
  useEffect(() => {
    const e = email.trim().toLowerCase();

    setError(null);

    // reset si email invalido / vacío
    if (!e || !emailOk) {
      setTenants([]);
      setTenantId("");
      setManualTenantId("");
      lastLookupEmailRef.current = "";
      setLoadingTenants(false);
      setDidLookup(false);
      return;
    }

    // evitar refetch si no cambió
    if (lastLookupEmailRef.current === e) return;

    const t = window.setTimeout(() => {
      setDidLookup(true);
      setLoadingTenants(true);

      apiFetch<LoginOptionsResponse>("/auth/login/options", {
        method: "POST",
        body: { email: e },
        timeoutMs: 8000,
      })
        .then((resp) => {
          const list = Array.isArray(resp?.tenants) ? resp.tenants : [];
          setTenants(list);

          if (list.length === 1) {
            // no hace falta setTenantId, effectiveTenantId ya lo toma de tenants[0]
            setTenantId("");
            return;
          }

          if (list.length > 1) {
            const saved = lastTenantKey ? safeGet(lastTenantKey) : null;
            const savedId = saved ? String(saved) : "";
            const exists = savedId && list.some((x) => x.id === savedId);

            setTenantId(exists ? savedId : list[0].id);
            return;
          }

          // si no hay joyerías, dejamos tenant vacío y habilitamos fallback manual
          setTenantId("");
        })
        .catch(() => {
          // si falla options, habilitamos fallback manual
          setTenants([]);
          setTenantId("");
        })
        .finally(() => {
          lastLookupEmailRef.current = e;
          setLoadingTenants(false);
        });
    }, 400);

    return () => window.clearTimeout(t);
  }, [email, emailOk, lastTenantKey, apiFetch]);

  const canSubmit = useMemo(() => {
    if (!emailOk) return false;
    if (!pass.trim()) return false;
    if (loadingTenants) return false;
    return Boolean(effectiveTenantId);
  }, [emailOk, pass, loadingTenants, effectiveTenantId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      if (!emailOk) return setError("Ingresá un email válido.");
      if (!pass.trim()) return setError("Ingresá tu contraseña.");
      if (loadingTenants) return setError("Buscando joyerías…");
      return setError("Completá la joyería (selección o código).");
    }

    try {
      setLoading(true);

      // ✅ Login (cookie httpOnly). Si el backend devuelve token, lo aprovechamos.
      const resp = await apiFetch<LoginResponseMaybe>("/auth/login", {
        method: "POST",
        body: {
          // tenantId: backend lo puede tratar opcional, pero si lo tenemos lo mandamos
          ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
          email: email.trim().toLowerCase(),
          password: pass,
        },
        timeoutMs: 10_000,
        on401: "throw",
      });

      // recordar “última joyería” para este email (solo si vino por options/selección)
      if (lastTenantKey && tenants.length > 1 && tenantId) safeSet(lastTenantKey, tenantId);

      // ✅ si vino token, guardamos y emitimos LOGIN (multi-tab)
      const maybeToken = String(resp?.accessToken || resp?.token || "").trim();
      if (maybeToken) {
        const fn = (API as any).storeTokenAndEmitLogin;
        if (typeof fn === "function") fn(maybeToken);
        else storeTokenAndEmitLoginFallback(maybeToken);
      } else {
        // ✅ cookie-only: emitimos login igualmente
        (API as any).emitLogin?.();
      }

      // ✅ refrescar /me con force para no reutilizar dedupe/promesa vieja
      await refreshMe({ force: true, silent: true } as any);

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const status = Number(err?.status);

      if (status === 409) {
        const payload = err?.data ?? {};

        if (payload?.code === "TENANT_REQUIRED" && Array.isArray(payload?.tenants)) {
          const list: TenantOption[] = payload.tenants
            .map((t: any) => ({ id: String(t?.id || ""), name: String(t?.name || "Joyería") }))
            .filter((t: TenantOption) => t.id);

          setDidLookup(true);
          setTenants(list);

          if (list.length > 0) {
            const saved = lastTenantKey ? safeGet(lastTenantKey) : null;
            const savedId = saved ? String(saved) : "";
            const exists = savedId && list.some((x) => x.id === savedId);
            setTenantId(exists ? savedId : list[0].id);
          } else {
            setTenantId("");
          }

          setError("Seleccioná la joyería para iniciar sesión.");
          return;
        }

        setError(getErrMessage(err, "No se pudo iniciar sesión."));
        return;
      }

      if (status === 401) {
        setError(getErrMessage(err, "Email o contraseña incorrectos."));
        return;
      }

      setEmail((v) => v.trim());
      setError(getErrMessage(err, "Error de red. Revisá tu conexión e intentá de nuevo."));
    } finally {
      setLoading(false);
    }
  }

  const iconBtnClass =
    "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center " +
    "rounded-md bg-transparent text-text/70 hover:text-text " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  const selectWrapClass = "relative";
  const selectChevronClass = "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted";

  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
        <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>
        <h1 className="mt-2 text-3xl font-semibold text-text">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-muted">Ingresá tus credenciales para continuar.</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">{error}</div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {/* 1) EMAIL */}
          <div>
            <label className="mb-2 block text-sm text-muted">Email</label>

            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);

                  lastLookupEmailRef.current = "";

                  setTenants([]);
                  setTenantId("");
                  setManualTenantId("");
                  setDidLookup(false);
                }}
                className={`tp-input ${hasEmail ? "pr-11" : ""}`}
                autoComplete="email"
              />

              {hasEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setEmail("");
                    setTenants([]);
                    setTenantId("");
                    setManualTenantId("");
                    lastLookupEmailRef.current = "";
                    setDidLookup(false);
                  }}
                  className={iconBtnClass}
                  aria-label="Limpiar email"
                  title="Limpiar"
                >
                  <XIcon />
                </button>
              )}
            </div>

            <div className="mt-2 min-h-[18px] text-xs text-muted">
              {emailOk ? (
                loadingTenants ? (
                  <span>Buscando joyerías…</span>
                ) : tenants.length === 0 ? (
                  <span>{didLookup ? "Si no aparece joyería, ingresá el código manual." : "—"}</span>
                ) : tenants.length === 1 ? (
                  <span>Joyería detectada: {tenants[0].name}</span>
                ) : (
                  <span>Seleccioná una joyería para continuar.</span>
                )
              ) : (
                <span>—</span>
              )}
            </div>
          </div>

          {/* 2) PASSWORD */}
          <div>
            <label className="mb-2 block text-sm text-muted">Contraseña</label>

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className={`tp-input ${hasPass ? "pr-11" : ""}`}
                autoComplete="current-password"
              />

              {hasPass && (
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className={iconBtnClass}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPass ? "Ocultar" : "Mostrar"}
                >
                  <EyeIcon open={showPass} />
                </button>
              )}
            </div>
          </div>

          {/* 3) JOYERÍA */}
          {showTenantSelect && (
            <div>
              <label className="mb-2 block text-sm text-muted">Joyería</label>

              <div className={selectWrapClass}>
                <select
                  className="tp-select appearance-none pr-10"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  disabled={!emailOk || loadingTenants || loading}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <span className={selectChevronClass} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </div>

              <p className="mt-2 text-xs text-muted">Se recuerda la última joyería usada para este email.</p>
            </div>
          )}

          {showManualTenantInput && (
            <div>
              <label className="mb-2 block text-sm text-muted">Código de joyería</label>
              <input
                type="text"
                value={manualTenantId}
                onChange={(e) => setManualTenantId(e.target.value)}
                className="tp-input"
                autoComplete="off"
                placeholder="Código de joyería"
                disabled={!emailOk || loadingTenants || loading}
              />
              <p className="mt-2 text-xs text-muted">
                No se detectó joyería automáticamente. Podés ingresar el código manual.
              </p>
            </div>
          )}

          <button type="submit" disabled={!canSubmit || loading} className="tp-btn-primary w-full">
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          <div className="flex items-center justify-between pt-1">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link to="/register" className="text-sm text-muted hover:underline">
              Crear cuenta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
