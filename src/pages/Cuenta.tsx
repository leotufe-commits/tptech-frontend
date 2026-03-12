// tptech-frontend/src/pages/Cuenta.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";
import { useNavigate } from "react-router-dom";
import TPInput from "../components/ui/TPInput";
import { TPButton } from "../components/ui/TPButton";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";
import { TPSectionShell } from "../components/ui/TPSectionShell";

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
  const { me, loading, error, refresh } = useMe();

  const [form, setForm] = useState<AccountBody>({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 🔐 PIN
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  /* -------------------------
     PIN STATE (defensivo)
  ------------------------- */
  const pinState = useMemo(() => {
    const anyMe: any = me;
    return {
      // useMe devuelve { user, jewelry, roles, permissions }
      // pero el backend a veces devolvía directo; por eso fallback
      hasQuickPin: Boolean(anyMe?.user?.hasQuickPin ?? anyMe?.hasQuickPin),
      pinEnabled: Boolean(anyMe?.user?.pinEnabled ?? anyMe?.pinEnabled),
    };
  }, [me]);

  /* -------------------------
     HYDRATE FORM
  ------------------------- */
  useEffect(() => {
    if (!me) return;

    const anyMe: any = me;

    setForm({
      firstName: String(anyMe.user?.firstName ?? anyMe.firstName ?? ""),
      lastName: String(anyMe.user?.lastName ?? anyMe.lastName ?? ""),
      email: String(anyMe.user?.email ?? anyMe.email ?? ""),
    });
  }, [me]);

  const canSave = useMemo(
    () => form.firstName.trim().length > 0 && form.lastName.trim().length > 0,
    [form]
  );

  function setField<K extends keyof AccountBody>(key: K, value: AccountBody[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ✅ helper seguro (tu refresh está tipado como () => Promise<void>)
  async function safeRefreshAll() {
    await (refresh as any)({ silent: true });
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
      await safeRefreshAll();
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
     Backend:
     - PUT    /users/me/quick-pin  { pin, currentPin? }
     - DELETE /users/me/quick-pin  { currentPin }
  ------------------------- */
  async function onSetPin() {
    setPinMsg(null);

    const cleanNew = onlyPin4(pinNew);
    const cleanCurrent = onlyPin4(pinCurrent);

    if (cleanNew.length !== 4) {
      setPinMsg("Ingresá un PIN nuevo de 4 dígitos.");
      return;
    }

    // si ya tiene PIN, backend exige currentPin
    if (pinState.hasQuickPin && cleanCurrent.length !== 4) {
      setPinMsg("Ingresá tu PIN actual (4 dígitos) para cambiarlo.");
      return;
    }

    setPinBusy(true);
    try {
      await apiFetch("/users/me/quick-pin", {
        method: "PUT",
        body: {
          pin: cleanNew,
          ...(pinState.hasQuickPin ? { currentPin: cleanCurrent } : {}),
        },
        timeoutMs: 12_000,
      });

      setPinCurrent("");
      setPinNew("");
      setPinMsg("PIN actualizado correctamente ✅");
      await safeRefreshAll();
    } catch (e: any) {
      setPinMsg(e?.message || "No se pudo actualizar el PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  async function onRemovePin() {
    setPinMsg(null);

    // si no hay pin, no hay nada que borrar
    if (!pinState.hasQuickPin) {
      setPinMsg("No tenés un PIN configurado.");
      return;
    }

    const cleanCurrent = onlyPin4(pinCurrent);
    if (cleanCurrent.length !== 4) {
      setPinMsg("Ingresá tu PIN actual (4 dígitos) para eliminarlo.");
      return;
    }

    setPinBusy(true);
    try {
      await apiFetch("/users/me/quick-pin", {
        method: "DELETE",
        body: { currentPin: cleanCurrent },
        timeoutMs: 12_000,
      });

      setPinCurrent("");
      setPinNew("");
      setPinMsg("PIN eliminado correctamente ✅");
      await safeRefreshAll();
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
    <TPSectionShell
      title="Cuenta"
      subtitle="Datos del usuario autenticado."
      className="mx-auto max-w-4xl p-6"
    >
      {msg && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      {/* DATOS */}
      <TPCard title="Datos personales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TPField label="Nombre">
            <TPInput
              value={form.firstName}
              onChange={(v) => setField("firstName", v)}
            />
          </TPField>

          <TPField label="Apellido">
            <TPInput
              value={form.lastName}
              onChange={(v) => setField("lastName", v)}
            />
          </TPField>

          <div className="md:col-span-2">
            <TPField label="Correo electrónico">
              <TPInput value={form.email} onChange={() => {}} disabled className="opacity-70" />
            </TPField>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <TPButton variant="primary" disabled={!canSave || saving} onClick={onSave}>
            {saving ? "Guardando…" : "Guardar"}
          </TPButton>
        </div>
      </TPCard>

      {/* SEGURIDAD */}
      <TPCard title="Seguridad">
        <div className="flex justify-between items-start gap-4">
          <p className="text-sm text-muted">La contraseña se gestiona desde recuperación.</p>

          <TPButton variant="secondary" onClick={onChangePassword}>
            Cambiar contraseña
          </TPButton>
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
              {/* ✅ PIN actual (solo si ya existe) */}
              {pinState.hasQuickPin && (
                <TPField label="PIN actual">
                  <TPInput
                    inputMode="numeric"
                    value={pinCurrent}
                    onChange={(v) => setPinCurrent(onlyPin4(v))}
                    maxLength={4}
                    disabled={pinBusy}
                  />
                </TPField>
              )}

              <div className={pinState.hasQuickPin ? "mt-4" : ""}>
                <TPField label={pinState.hasQuickPin ? "Nuevo PIN" : "Definir PIN"}>
                  <TPInput
                    inputMode="numeric"
                    value={pinNew}
                    onChange={(v) => setPinNew(onlyPin4(v))}
                    maxLength={4}
                    disabled={pinBusy}
                  />
                </TPField>

                <TPButton
                  variant="primary"
                  className="mt-3 w-full"
                  disabled={
                    pinBusy ||
                    pinNew.length !== 4 ||
                    (pinState.hasQuickPin && pinCurrent.length !== 4)
                  }
                  onClick={onSetPin}
                >
                  {pinBusy ? "Guardando…" : pinState.hasQuickPin ? "Cambiar PIN" : "Guardar PIN"}
                </TPButton>
              </div>
            </div>

            {pinState.hasQuickPin && (
              <div>
                <TPField label="Eliminar PIN">
                  <div className="text-xs text-muted">Elimina la clave rápida de tu cuenta.</div>
                </TPField>

                <TPButton
                  variant="secondary"
                  className="mt-6 w-full"
                  disabled={pinBusy || pinCurrent.length !== 4}
                  onClick={onRemovePin}
                >
                  {pinBusy ? "Procesando…" : "Eliminar PIN"}
                </TPButton>
              </div>
            )}
          </div>
        </div>
      </TPCard>
    </TPSectionShell>
  );
}
