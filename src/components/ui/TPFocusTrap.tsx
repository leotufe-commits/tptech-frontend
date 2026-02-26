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

    const container = containerRef.current;
    if (!container) return;

    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      // re-chequeo por seguridad
      if (!containerRef.current) return;

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
      const c = containerRef.current;
      if (!c) return;

      const target = e.target as Node | null;
      if (!target) return;

      if (!c.contains(target)) {
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocusIn);

    // foco inicial
    first.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}