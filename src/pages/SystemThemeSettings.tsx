// tptech-frontend/src/pages/SystemThemeSettings.tsx
import React, { useMemo } from "react";
import { Palette } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useAuth } from "../context/AuthContext";

export default function SystemThemeSettings() {
  const { theme, themes } = useTheme();
  const { user } = useAuth();

  const label = useMemo(() => {
    return themes.find((t) => t.value === theme)?.label ?? "Tema";
  }, [themes, theme]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-border bg-card grid place-items-center">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-text">Tema</div>
          <div className="text-sm text-muted">
            Elegí el aspecto visual. Se guarda{" "}
            <span className="font-semibold text-text">por usuario</span>
            {user?.email ? (
              <>
                {" "}
                (<span className="font-semibold text-text">{user.email}</span>)
              </>
            ) : null}
            .
          </div>
        </div>
      </div>

      <div className="tp-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface2 text-primary">
              <Palette size={20} />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold text-text">Seleccionar tema</div>
              <div className="text-sm text-muted mt-0.5">
                Actual: <span className="font-semibold text-text">{label}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-3 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
          <ThemeSwitcher variant="menu" />
        </div>

        <div className="text-[11px] text-muted">
          Tip: también lo podés cambiar desde el menú rápido del Topbar.
        </div>
      </div>
    </div>
  );
}
