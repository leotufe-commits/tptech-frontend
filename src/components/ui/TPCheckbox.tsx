import React from "react";
import { cn } from "./tp";

type TPCheckboxProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  className?: string;
};

export function TPCheckbox({
  checked,
  onChange,
  disabled,
  label,
  className,
}: TPCheckboxProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-sm",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export default TPCheckbox;