// src/components/ui/TPField.tsx
import React from "react";
import { cn } from "./tp";

/**
 * ✅ Auto-fix:
 * Si TPField envuelve TPInput/TPComboCreatable/TPSelect,
 * les inyecta noLabelSpace=true para evitar "doble label espacio".
 */
function withNoLabelSpace(children: React.ReactNode) {
  const targets = new Set(["TPInput", "TPComboCreatable", "TPSelect"]);

  const enhance = (child: React.ReactNode): React.ReactNode => {
    if (!React.isValidElement(child)) return child;

    // Solo componentes React (no tags HTML)
    const t: any = child.type as any;
    const isComponent = typeof t === "function" || typeof t === "object";
    if (!isComponent) return child;

    const name = String(t?.displayName || t?.name || "");
    if (!targets.has(name)) return child;

    // Si ya viene definido, lo respetamos
    const props: any = child.props || {};
    if (props.noLabelSpace === true) return child;

    return React.cloneElement(child as any, { noLabelSpace: true });
  };

  // Si viene un array de children (ej: <>...</>)
  if (Array.isArray(children)) return children.map(enhance);

  // Si viene un fragment, procesamos sus hijos
  if (React.isValidElement(children) && (children as any).type === React.Fragment) {
    const fragChildren = (children as any).props?.children;
    const next = Array.isArray(fragChildren) ? fragChildren.map(enhance) : enhance(fragChildren);
    return <>{next}</>;
  }

  return enhance(children);
}

export function TPField({
  label,
  hint,
  error,
  required,
  children,
  className,
  labelRight,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const labelText = String(label || "");
  const showRealLabel = Boolean(labelText.trim());

  const fixedChildren = withNoLabelSpace(children);

  return (
    <div className={cn("tp-field w-full", className)}>
      {(showRealLabel || labelRight) ? (
        // ✅ aire global arriba del bloque de label (impacta todos los formularios)
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <label
            className={cn(
              "tp-field-label",
              "leading-none",
              !showRealLabel && "tp-field-label--empty"
            )}
            aria-hidden={!showRealLabel}
          >
            {showRealLabel ? (
              <>
                {labelText}
                {required ? <span> *</span> : null}
              </>
            ) : (
              "\u00A0"
            )}
          </label>

          {labelRight ? <div className="text-xs text-muted leading-4">{labelRight}</div> : null}
        </div>
      ) : (
        <span className="tp-field-label tp-field-label--empty" aria-hidden="true">
          {"\u00A0"}
        </span>
      )}

      {fixedChildren}

      {error ? (
        <div className="mt-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-text">
          {error}
        </div>
      ) : hint ? (
        <div className="mt-1 text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export default TPField;