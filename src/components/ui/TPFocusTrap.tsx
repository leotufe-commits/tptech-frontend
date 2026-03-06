// src/components/ui/TPFocusTrap.tsx
import React, { useEffect, useRef } from "react";

export default function TPFocusTrap({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function isInsideAriaModalDialog(el: HTMLElement | null) {
      if (!el) return false;
      return Boolean(el.closest?.('[role="dialog"][aria-modal="true"]'));
    }

    function getFocusable(container: HTMLElement) {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        const anyEl = el as any;
        if (anyEl.disabled) return false;
        if (el.getAttribute("aria-disabled") === "true") return false;
        if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
        return true;
      });
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const activeEl = document.activeElement as HTMLElement | null;

      // ✅ si el foco está en un modal aria-modal (y NO es hijo del container), no tocar
      if (activeEl && isInsideAriaModalDialog(activeEl) && !container.contains(activeEl)) {
        return;
      }

      const focusable = getFocusable(container);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function handleFocusIn(e: FocusEvent) {
      const container = containerRef.current;
      if (!container) return;

      const targetEl = e.target as HTMLElement | null;
      if (!targetEl) return;

      // ✅ si el foco va a un modal aria-modal (por ej “Agregar nuevo ítem”), no lo devuelvas al fondo
      if (isInsideAriaModalDialog(targetEl) && !container.contains(targetEl)) {
        return;
      }

      if (!container.contains(targetEl)) {
        const focusable = getFocusable(container);
        if (focusable.length) focusable[0].focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocusIn);

    // foco inicial solo si NO hay un aria-modal encima
    const container = containerRef.current;
    const activeEl = document.activeElement as HTMLElement | null;
    if (container && !(activeEl && isInsideAriaModalDialog(activeEl) && !container.contains(activeEl))) {
      const focusable = getFocusable(container);
      if (focusable.length) focusable[0].focus();
    }

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}