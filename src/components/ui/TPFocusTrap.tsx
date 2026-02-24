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

    function getFocusable() {
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(
          [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
          ].join(",")
        )
      );

      return elements.filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
      });
    }

    function focusFirst() {
      const focusable = getFocusable();
      if (!focusable.length) return;
      try {
        focusable[0].focus();
      } catch {}
    }

    function focusLast() {
      const focusable = getFocusable();
      if (!focusable.length) return;
      try {
        focusable[focusable.length - 1].focus();
      } catch {}
    }

    // ✅ Si el foco se va afuera del contenedor, lo traemos de vuelta.
    function handleFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (container.contains(target)) return;

      // foco se escapó (ej: sidebar) -> lo volvemos a meter
      focusFirst();
    }

    // ✅ TAB circular dentro del contenedor
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      const current = document.activeElement as HTMLElement | null;
      const inside = current ? container.contains(current) : false;

      // si por cualquier razón el foco ya está afuera, lo metemos adentro
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (current === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleKeyDown, true);

    // ✅ al activar, aseguramos foco dentro
    setTimeout(() => {
      const cur = document.activeElement as HTMLElement | null;
      if (!cur || !container.contains(cur)) focusFirst();
    }, 0);

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}