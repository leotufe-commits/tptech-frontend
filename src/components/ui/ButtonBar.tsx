// tptech-frontend/src/components/ui/ButtonBar.tsx
import React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Props = {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "between";
  wrap?: boolean;
};

function ButtonBarImpl({ children, className, align = "right", wrap = false }: Props) {
  const justify =
    align === "left" ? "justify-start" : align === "between" ? "justify-between" : "justify-end";

  return (
    <div
      className={cn(
        "flex items-center gap-2 shrink-0",
        justify,
        wrap ? "flex-wrap" : "flex-nowrap",
        className
      )}
    >
      {children}
    </div>
  );
}

/** ✅ Default export (para importar sin romper nunca) */
export default ButtonBarImpl;

/** ✅ Named export (por si querés usarlo así también) */
export const ButtonBar = ButtonBarImpl;
