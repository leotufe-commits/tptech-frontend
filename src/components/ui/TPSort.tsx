// tptech-frontend/src/components/ui/TPSort.tsx
import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "./tp";

export type SortDir = "asc" | "desc";

export function SortArrows({
  dir = "asc",
  active = false,
  className,
}: {
  dir?: SortDir;
  active?: boolean;
  className?: string;
}) {
  // ✅ EXACTO estilo "print 2"
  // - chevrons up/down (lucide)
  // - uno fuerte, el otro tenue cuando está activo
  // - ambos tenues cuando está inactivo
  const upCls = !active ? "opacity-35" : dir === "asc" ? "opacity-100" : "opacity-20";
  const downCls = !active ? "opacity-35" : dir === "desc" ? "opacity-100" : "opacity-20";

  return (
    <span
      className={cn("inline-flex flex-col leading-none -space-y-1", className)}
      aria-hidden="true"
    >
      <ChevronUp className={cn("h-3.5 w-3.5", upCls)} />
      <ChevronDown className={cn("h-3.5 w-3.5", downCls)} />
    </span>
  );
}
