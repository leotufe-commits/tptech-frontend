import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";
import { useNavigate } from "react-router-dom";

type AccountBody = {
  firstName: string;
  lastName: string;
  email: string;
};

type UpdateAccountPayload = {
  firstName: string;
  lastName: string;
};

export default function Cuenta() {
  const navigate = useNavigate();
  const { me, loading, error, refresh } = useMe();

  const [form, setForm] = useState<AccountBody>({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;

    // 🔒 Mapeo defensivo: soporta distintas estructuras del backend
    const anyMe: any = me;

    const email =
      anyMe.email ??
      anyMe.user?.email ??
      "";

    const firstName =
      anyMe.firstName ??
      anyMe.user?.firstName ??
      "";

    const lastName =
      anyMe.lastName ??
      anyMe.user?.lastName ??
      "";

    setForm({
      firstName: String(firstName || ""),
      lastName: String(lastName || ""),
      email: String(email || ""),
    });

    setReady(true);
  }, [me]);

  const canSave = useMemo(() => {
    return (
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0
    );
  }, [form.firstName, form.lastName]);

  function setField<K extends keyof AccountBody>(
    key: K,
    value: AccountBody[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setMsg(null);

    try {
      setSaving(true);

      const payload: UpdateAccountPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };

      await apiFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setMsg("Guardado correctamente ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  function onChangePassword() {
    navigate("/forgot-password");
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-[color:var(--muted)]">
        Cargando…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h2 className="text-xl font-semibold text-text">Cuenta</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Datos del usuario que inició sesión.
      </p>

      {!ready && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            boxShadow: "var(--shadow)",
          }}
        >
          Preparando datos de usuario…
        </div>
      )}

      {msg && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            boxShadow: "var(--shadow)",
          }}
        >
          {msg}
        </div>
      )}

      {/* Datos del usuario */}
      <div
        className="mt-6 rounded-2xl p-6"
        style={{
          border: "1px solid var(--border)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Nombre">
            <input
              className="tp-input"
              value={form.firstName}
              onChange={(e) =>
                setField("firstName", e.target.value)
              }
              placeholder="Nombre"
            />
          </Field>

          <Field label="Apellido">
            <input
              className="tp-input"
              value={form.lastName}
              onChange={(e) =>
                setField("lastName", e.target.value)
              }
              placeholder="Apellido"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Correo electrónico">
              <input
                className="tp-input"
                value={form.email}
                disabled
                style={{
                  opacity: 0.85,
                  background:
                    "color-mix(in oklab, var(--card) 82%, var(--bg))",
                }}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className="tp-btn-primary"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Seguridad */}
      <div
        className="mt-6 rounded-2xl p-6"
        style={{
          border: "1px solid var(--border)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-text">
              Seguridad
            </div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              La contraseña se cambia desde el flujo de recuperación.
            </div>
          </div>

          <button
            type="button"
            onClick={onChangePassword}
            className="tp-btn-secondary"
          >
            Cambiar contraseña
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-[color:var(--muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
