import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Extra classes for the wrapper (usually flex sizing). */
  className?: string;
}

/**
 * Search field that expands and lifts on focus so the typed text is clearly
 * visible, with a clear button once there is a query.
 */
const SearchField = ({ value, onChange, placeholder, className = "" }: Props) => {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search
        className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${
          focused ? "text-primary" : "text-muted-foreground"
        }`}
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`w-full pl-11 ${value ? "pr-11" : "pr-4"} rounded-lg bg-card text-foreground
          font-medium placeholder:font-normal placeholder:text-muted-foreground
          border outline-none
          transition-[height,font-size,border-color,box-shadow] duration-200 ease-out
          [&::-webkit-search-cancel-button]:appearance-none
          ${focused
            ? "h-[3.25rem] text-base border-primary/60 shadow-[0_0_0_3px_hsl(var(--primary)/0.13),var(--shadow-raised)]"
            : "h-12 text-[0.95rem] border-border hover:border-primary/30"}`}
      />
      {value && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
          title={t("app.cancel")}
          aria-label={t("app.cancel")}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SearchField;
