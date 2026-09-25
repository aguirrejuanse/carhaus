"use client";

/** Segmented "Solo ida" / "Ida y vuelta" toggle for the booking form. */

import { SegmentedControl } from "./segmented-control";

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
    <SegmentedControl
      options={TRIP_MODE_OPTIONS}
      value={roundTrip}
      onChange={onChange}
    />
  );
}
