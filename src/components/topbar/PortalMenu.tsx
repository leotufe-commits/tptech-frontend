// tptech-frontend/src/components/topbar/PortalMenu.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clamp, useEscapeToClose, useOutsideClickToClose } from "./topbar.utils";

export type PortalMenuProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
};

export function PortalMenu({
  open,
  anchorRef,
  onClose,
  children,
  width = 340,
}: PortalMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [, forceTick] = useState(0);

  useEscapeToClose(open, onClose);
  useOutsideClickToClose(open, menuRef, onClose);

  useEffect(() => {
    if (!open) return;
    const onRecalc = () => forceTick((t) => t + 1);
    window.addEventListener("resize", onRecalc);
    window.addEventListener("scroll", onRecalc, true);
    return () => {
      window.removeEventListener("resize", onRecalc);
      window.removeEventListener("scroll", onRecalc, true);
    };
  }, [open]);

  if (!open) return null;

  const r = anchorRef.current?.getBoundingClientRect();
  const viewportPad = 10;
  const gap = 10;

  const maxH = Math.min(560, Math.max(280, window.innerHeight - viewportPad * 2));

  const anchorRight = r?.right ?? 0;
  const anchorTop = r?.top ?? 0;
  const anchorBottom = r?.bottom ?? 0;

  const leftWanted = anchorRight - width;
  const left = clamp(leftWanted, viewportPad, window.innerWidth - viewportPad - width);

  const spaceBelow = window.innerHeight - viewportPad - anchorBottom;
  const spaceAbove = anchorTop - viewportPad;

  const openDown = spaceBelow >= 240 || spaceBelow >= spaceAbove;
  const topDown = clamp(anchorBottom + gap, viewportPad, window.innerHeight - viewportPad - maxH);
  const topUp = clamp(anchorTop - gap - maxH, viewportPad, window.innerHeight - viewportPad - maxH);
  const top = openDown ? topDown : topUp;

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onMouseDown={onClose} aria-hidden="true" />
      <div
        ref={menuRef}
        style={{ position: "fixed", left, top, width, maxHeight: maxH, zIndex: 9999 }}
        className="rounded-2xl border border-border bg-bg shadow-[0_18px_40px_rgba(0,0,0,0.18)] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tp-scroll overflow-auto" style={{ maxHeight: maxH }}>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

// ✅ compat: si en algún lado lo importan como default
export default PortalMenu;
