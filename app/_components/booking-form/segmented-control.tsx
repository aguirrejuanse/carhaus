"use client";

/** Generic two-or-more-option segmented control — the shared visual for
 *  "Solo ida / Ida y vuelta" and "Ahora / Programar". */

interface Props<T> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T>({ options, value, onChange }: Props<T>) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${
            value === opt.value
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
