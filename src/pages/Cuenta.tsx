// tptech-frontend/src/pages/Cuenta.tsx
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* =========================
   TYPES
========================= */
type AccountBody = {
  firstName: string;
  lastName: string;
  email: string;
};

type UpdateAccountPayload = {
  firstName: string;
  lastName: string;
};

/* =========================
   HELPERS
========================= */
function onlyPin4(v: string) {
  return String(v ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

/* =========================
   PAGE
========================= */
export default function Cuenta() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { me, loading, error, refresh } = useMe();

  const [form, setForm] = useState<AccountBody>({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 🔐 PIN
  const [pinNew, setPinNew] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  /* -------------------------
     PIN STATE (defensivo)
  ------------------------- */
  const pinState = useMemo(() => {
    const anyMe: any = me;
    return {
      hasQuickPin: Boolean(anyMe?.hasQuickPin ?? anyMe?.user?.hasQuickPin),
      pinEnabled: Boolean(anyMe?.pinEnabled ?? anyMe?.user?.pinEnabled),
    };
  }, [me]);

  /* -------------------------
     HYDRATE FORM
  ------------------------- */
  useEffect(() => {
    if (!me) return;

    const anyMe: any = me;

    setForm({
      firstName: String(anyMe.firstName ?? anyMe.user?.firstName ?? ""),
      lastName: String(anyMe.lastName ?? anyMe.user?.lastName ?? ""),
      email: String(anyMe.email ?? anyMe.user?.email ?? ""),
    });
  }, [me]);

  const canSave = useMemo(
    () => form.firstName.trim().length > 0 && form.lastName.trim().length > 0,
    [form]
  );

  function setField<K extends keyof AccountBody>(key: K, value: AccountBody[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* -------------------------
     ACCOUNT
  ------------------------- */
  async function onSave() {
    setMsg(null);
    setSaving(true);
    try {
      const payload: UpdateAccountPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };

      await apiFetch("/auth/me", { method: "PUT", body: payload });

      setMsg("Datos guardados correctamente ✅");
      await refresh();
      await auth.refreshMe({ silent: true });
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  function onChangePassword() {
    navigate("/forgot-password");
  }

  /* -------------------------
     PIN ACTIONS (MI CUENTA)
  ------------------------- */
  async function onSetPin() {
    setPinMsg(null);
    const clean = onlyPin4(pinNew);

    if (clean.length !== 4) {
      setPinMsg("Ingresá un PIN de 4 dígitos.");
      return;
    }

    setPinBusy(true);
    try {
      await auth.pinSet(clean);
      setPinNew("");
      setPinMsg("PIN actualizado correctamente ✅");
      await refresh();
      await auth.refreshMe({ silent: true });
    } catch (e: any) {
      setPinMsg(e?.message || "No se pudo actualizar el PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  async function onRemovePin() {
    setPinMsg(null);
    setPinBusy(true);
    try {
      await auth.pinRemove();
      setPinNew("");
      setPinMsg("PIN eliminado correctamente ✅");
      await refresh();
      await auth.refreshMe({ silent: true });
    } catch (e: any) {
      setPinMsg(e?.message || "No se pudo eliminar el PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  /* -------------------------
     RENDER
  ------------------------- */
  if (loading) {
    return <div className="p-6 text-sm text-muted">Cargando…</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-500">Error: {error}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Cuenta</h2>
        <p className="text-sm text-muted">Datos del usuario autenticado.</p>
      </header>

      {msg && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      {/* DATOS */}
      <Card title="Datos personales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Nombre">
            <input
              className="tp-input"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
            />
          </Field>

          <Field label="Apellido">
            <input
              className="tp-input"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Correo electrónico">
              <input className="tp-input opacity-70" value={form.email} disabled />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            className="tp-btn-primary"
            disabled={!canSave || saving}
            onClick={onSave}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </Card>

      {/* SEGURIDAD */}
      <Card title="Seguridad">
        <div className="flex justify-between items-start gap-4">
          <p className="text-sm text-muted">
            La contraseña se gestiona desde recuperación.
          </p>

          <button className="tp-btn-secondary" onClick={onChangePassword}>
            Cambiar contraseña
          </button>
        </div>

        {/* PIN */}
        <div className="mt-6 space-y-3">
          <div className="text-sm font-semibold">Mi PIN (4 dígitos)</div>

          <div className="text-sm text-muted">
            Estado:{" "}
            <b>
              {pinState.hasQuickPin
                ? pinState.pinEnabled
                  ? "Habilitado"
                  : "Configurado (deshabilitado)"
                : "No configurado"}
            </b>
          </div>

          {pinMsg && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              {pinMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Field label={pinState.hasQuickPin ? "Nuevo PIN" : "Definir PIN"}>
                <input
                  className="tp-input"
                  inputMode="numeric"
                  value={pinNew}
                  onChange={(e) => setPinNew(onlyPin4(e.target.value))}
                  maxLength={4}
                  disabled={pinBusy}
                />
              </Field>

              <button
                className="tp-btn-primary mt-3 w-full"
                disabled={pinBusy || pinNew.length !== 4}
                onClick={onSetPin}
              >
                {pinBusy
                  ? "Guardando…"
                  : pinState.hasQuickPin
                  ? "Cambiar PIN"
                  : "Guardar PIN"}
              </button>
            </div>

            {pinState.hasQuickPin && (
              <div>
                <Field label="Eliminar PIN">
                  <div className="text-xs text-muted">
                    Elimina la clave rápida de tu cuenta.
                  </div>
                </Field>

                <button
                  className="tp-btn-secondary mt-6 w-full"
                  disabled={pinBusy}
                  onClick={onRemovePin}
                >
                  {pinBusy ? "Procesando…" : "Eliminar PIN"}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-muted">{label}</label>
      {children}
    </div>
  );
}
