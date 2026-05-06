// src/components/ui/TPTabs.tsx
// Segmented tab control reutilizable — estilo TP UI.
// Reemplaza el patrón de TPButton + clases manuales para navegación entre secciones.
import { cn } from "./tp";

type TabOption = {
  label: string;
  value: string;
};

type TPTabsProps = {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  /** "sm" → más compacto, "md" (default) → tamaño estándar */
  size?: "sm" | "md";
};

export function TPTabs({ options, value, onChange, size = "md" }: TPTabsProps) {
  return (
    <div className="flex items-center gap-1" role="tablist">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              // base
              "rounded-full border font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
              // size
              size === "sm"
                ? "px-3 py-1 text-xs"
                : "px-4 py-1.5 text-sm",
              // estado activo
              isActive
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted border-border hover:border-primary/40 hover:text-primary hover:bg-primary/10"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default TPTabs;
