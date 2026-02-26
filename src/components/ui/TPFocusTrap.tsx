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

    function getFocusable(container: HTMLElement) {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        // Evitar elementos deshabilitados / invisibles
        const anyEl = el as any;
        if (anyEl.disabled) return false;
        if (el.getAttribute("aria-disabled") === "true") return false;
        // si está oculto por display:none o similar
        if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
        return true;
      });
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

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

      const target = e.target as Node | null;
      if (!target) return;

      if (!container.contains(target)) {
        const focusable = getFocusable(container);
        if (focusable.length) focusable[0].focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocusIn);

    // foco inicial
    const container = containerRef.current;
    if (container) {
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