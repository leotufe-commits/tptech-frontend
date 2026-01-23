import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function JewelryQuickSwitchToggle() {
  const { jewelry, permissions, refreshMe } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!jewelry) return null;

  const canEdit = permissions.includes("COMPANY_SETTINGS:EDIT");
  const enabled = Boolean(jewelry.quickSwitchEnabled);

  async function toggle(next: boolean) {
    setError(null);
    try {
      setLoading(true);
      await apiFetch("/auth/me/jewelry/quick-switch", {
        method: "POST",
        body: { enabled: next },
      });
      await refreshMe({ force: true, silent: true });
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-text">Cambio rápido de usuario</h3>
      </div>

      <p className="mb-4 text-sm text-muted">
        Permite cambiar de usuario desde la pantalla bloqueada usando PIN,
        sin cerrar sesión.
      </p>

      {error && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-text">
          Estado:{" "}
          <strong className={enabled ? "text-green-600" : "text-muted"}>
            {enabled ? "Habilitado" : "Deshabilitado"}
          </strong>
        </span>

        <button
          disabled={!canEdit || loading}
          onClick={() => toggle(!enabled)}
          className="tp-btn-secondary inline-flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {enabled ? "Desactivar" : "Activar"}
        </button>
      </div>

      {!canEdit && (
        <div className="mt-3 text-xs text-muted">
          Solo administradores pueden modificar esta opción.
        </div>
      )}
    </div>
  );
}
