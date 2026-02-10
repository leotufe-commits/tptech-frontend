// src/components/sidebar/sidebar.icons.tsx
import type { ComponentType } from "react";

export type IconType = ComponentType<{ size?: number; className?: string }>;

/** Icono “Lingotes” (sin depender de lucide) */
export const GoldBarsIcon: IconType = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.8 12.2 9.2 10.4c.5-.2 1.1-.2 1.6 0l4.4 1.8c.8.3 1.3 1.1 1.1 2l-1.1 5c-.2.9-1 1.6-2 1.6H7.8c-1 0-1.8-.7-2-1.6l-1.1-5c-.2-.9.3-1.7 1.1-2Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M7.4 5.9 11 4.6c.6-.2 1.3-.2 1.9 0l3.6 1.3c.8.3 1.4 1.2 1.2 2.1l-.3 1.4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      opacity="0.9"
    />
    <path d="M9 14.2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
  </svg>
);
