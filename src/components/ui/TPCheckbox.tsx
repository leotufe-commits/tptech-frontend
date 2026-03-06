import React, { useEffect, useRef } from "react";
import { cn } from "./tp";

type TPCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "checked" | "onChange" | "type" | "children" | "dangerouslySetInnerHTML"
> & {
  checked: boolean;
  onChange: (v: boolean) => void;
  indeterminate?: boolean;
  label?: React.ReactNode;
  className?: string;

  // blindaje extra (por si alguien intenta pasarlos)
  children?: never;
  dangerouslySetInnerHTML?: never;
};

export function TPCheckbox({
  checked,
  onChange,
  indeterminate,
  disabled,
  label,
  className,

  // ✅ tragamos estos props para que JAMÁS lleguen al <input />
  children,
  dangerouslySetInnerHTML,

  ...rest
}: TPCheckboxProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <label
      className={cn("flex items-center gap-2 text-sm", disabled && "opacity-60 cursor-not-allowed", className)}
    >
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      {label}
    </label>
  );
}

export default TPCheckbox;