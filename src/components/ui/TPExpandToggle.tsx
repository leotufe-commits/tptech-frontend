// src/components/ui/TPExpandToggle.tsx
import React from "react";
import { ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { cn } from "./tp";

interface TPExpandToggleProps {
  /** Si todos los nodos están expandidos */
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Botón que alterna entre "Expandir todo" y "Colapsar todo" en tablas jerárquicas.
 * Usa el mismo estilo y lógica que en ConfiguracionSistemaCategorias.
 */
export function TPExpandToggle({ isExpanded, onToggle, className }: TPExpandToggleProps) {
  return (
    <button
      type="button"
      title={isExpanded ? "Colapsar todo" : "Expandir todo"}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border bg-surface h-9 w-9 text-text hover:bg-surface2/60 transition-colors shrink-0",
        className,
      )}
    >
      {isExpanded ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
    </button>
  );
}
