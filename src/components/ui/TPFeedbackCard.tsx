// src/components/ui/TPFeedbackCard.tsx
// Pantalla de feedback de página completa para flujos de auth.
// Usada en: verify-email, post-registro, reset-password, accept-invite.
import React from "react";
import { cn } from "./tp";

// ─────────────────────────────────────────────────────────────────────────────

type Tone = "success" | "error" | "warning" | "primary";

const ICON_BG: Record<Tone, string> = {
  success: "bg-green-500/10",
  error:   "bg-red-500/10",
  warning: "bg-amber-500/10",
  primary: "bg-primary/10",
};

const ICON_TEXT: Record<Tone, string> = {
  success: "text-green-500",
  error:   "text-red-500",
  warning: "text-amber-500",
  primary: "text-primary",
};

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  /** Nodo del icono dentro del círculo (ej: <CheckCircle className="w-8 h-8" />) */
  icon:          React.ReactNode;
  /** Tono del círculo del icono — define colores del fondo y del ícono */
  tone?:         Tone;
  /** Título principal */
  title:         string;
  /** Descripción (puede incluir JSX con <strong>, etc.) */
  description?:  React.ReactNode;
  /** Contenido adicional: inputs, mensajes de estado, etc. Se renderiza bajo la descripción */
  children?:     React.ReactNode;
  /** Botones de acción (se renderizan con gap entre ellos en columna) */
  actions?:      React.ReactNode;
  /** Link o texto pequeño al pie de la card */
  footer?:       React.ReactNode;
};

// ─────────────────────────────────────────────────────────────────────────────

export function TPFeedbackCard({
  icon,
  tone = "primary",
  title,
  description,
  children,
  actions,
  footer,
}: Props) {
  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-soft">
        <div className="p-8 space-y-6">

          {/* ── Icono + título + descripción ── */}
          <div className="text-center space-y-4">
            <div className={cn(
              "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
              ICON_BG[tone]
            )}>
              <span className={ICON_TEXT[tone]}>{icon}</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-text">{title}</h1>
              {description != null && (
                <div className="text-sm text-muted leading-relaxed">{description}</div>
              )}
            </div>
          </div>

          {/* ── Contenido extra (inputs, mensajes, etc.) ── */}
          {children}

          {/* ── Botones ── */}
          {actions != null && (
            <div className="flex flex-col gap-3">
              {actions}
            </div>
          )}

          {/* ── Pie ── */}
          {footer != null && (
            <div className="text-center">
              {footer}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default TPFeedbackCard;
