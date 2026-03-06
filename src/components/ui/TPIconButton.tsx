import React from "react";
import { cn } from "./tp";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function TPIconButton({
  className,
  disabled,
  active,
  children,
  type,
  ...rest
}: Props) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-border bg-transparent",
        "h-9 w-9 text-text/90 transition-all",
        "hover:bg-surface2/60 hover:scale-[1.03]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        active && "bg-primary/10 text-primary border-primary/30",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:scale-100",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export default TPIconButton;