import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface StyledSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface StyledSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: StyledSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional element rendered inside the trigger, before the value (e.g. an icon). */
  icon?: React.ReactNode;
}

// Radix Select reserves "" for the cleared state, so map empty <-> sentinel.
const EMPTY = "__all__";

/**
 * Drop-in replacement for a native <select> using the themed Radix Select.
 * Mirrors a simple value/onValueChange/options API so it's easy to swap in.
 */
export function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  disabled,
  icon,
}: StyledSelectProps) {
  const radixValue = value === "" ? EMPTY : value;

  return (
    <Select
      value={radixValue}
      onValueChange={(v) => onValueChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "relative bg-secondary/50 border-white/[0.08] text-foreground focus:ring-primary/30",
          icon && "pl-9",
          className,
        )}
      >
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </span>
        )}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-white/[0.08]">
        {options.map((opt) => (
          <SelectItem
            key={opt.value === "" ? EMPTY : opt.value}
            value={opt.value === "" ? EMPTY : opt.value}
            disabled={opt.disabled}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
