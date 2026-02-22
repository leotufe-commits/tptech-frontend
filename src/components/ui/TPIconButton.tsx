import React from "react";
import { cn } from "./tp";

export function TPIconButton({
  className,
  disabled,
  children,
  type,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-border bg-transparent",
        "h-9 w-9 text-text/90 hover:bg-surface2/60",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export default TPIconButton;