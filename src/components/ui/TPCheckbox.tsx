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
};

export function TPCheckbox({
  checked,
  onChange,
  indeterminate,
  disabled,
  label,
  className,
  // ✅ por seguridad: nunca lo pasamos al input
  children,
  dangerouslySetInnerHTML,
  ...rest
}: TPCheckboxProps & {
  children?: never;
  dangerouslySetInnerHTML?: never;
}) {
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