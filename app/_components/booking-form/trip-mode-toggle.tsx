"use client";

/** Segmented "Solo ida" / "Ida y vuelta" toggle for the booking form. */

const TRIP_MODE_OPTIONS = [
  { value: false, label: "Solo ida" },
  { value: true, label: "Ida y vuelta" },
] as const;

export function TripModeToggle({
  roundTrip,
  onChange,
}: {
  roundTrip: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {TRIP_MODE_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${
            roundTrip === opt.value
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
