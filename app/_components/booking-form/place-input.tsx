"use client";

/**
 * Address input with Google Places suggestions. Free text stays valid —
 * picking a suggestion additionally stores its `place_id` in a hidden
 * `<name>PlaceId` field so the price preview can ask Distance Matrix for
 * an exact route instead of re-geocoding ambiguous text ("9 de Julio
 * 1276" exists in both Mendoza and CABA).
 *
 * Rate-limit discipline: 350 ms debounce, 3-char minimum, and every new
 * keystroke aborts the in-flight request — at most one billable
 * autocomplete call settles per pause. Provider failures degrade to a
 * plain text input (suggestions are an enhancement, never a blocker).
 */

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useRef, useState } from "react";
import {
  fetchPlaceSuggestions,
  type PlaceSuggestion,
} from "@/lib/services/places";

const SUGGEST_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

interface Props {
  id: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  onValueCommit: () => void;
}

export function PlaceInput({
  id,
  name,
  placeholder,
  defaultValue,
  onValueCommit,
}: Props) {
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [placeId, setPlaceId] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  const fetchSuggestions = (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchPlaceSuggestions(query, controller.signal)
      .then(setItems)
      .catch(() => setItems([])); // degrade to free text — never block
  };

  return (
    <>
      <Autocomplete.Root
        items={items}
        itemToStringValue={(item: PlaceSuggestion) => item.text}
        defaultValue={defaultValue}
        onValueChange={(value, details) => {
          onValueCommit();
          if (details.reason === "item-press") {
            const picked = items.find((item) => item.text === value);
            setPlaceId(picked?.placeId ?? "");
            setItems([]);
            return;
          }
          setPlaceId("");
          clearTimeout(debounceRef.current);
          const query = value.trim();
          if (query.length < MIN_QUERY_LENGTH) {
            abortRef.current?.abort();
            setItems([]);
            return;
          }
          debounceRef.current = setTimeout(
            () => fetchSuggestions(query),
            SUGGEST_DEBOUNCE_MS,
          );
        }}
      >
        <Autocomplete.Input
          id={id}
          name={name}
          required
          maxLength={200}
          placeholder={placeholder}
          autoComplete="off"
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm"
        />
        <Autocomplete.Portal>
          <Autocomplete.Positioner
            sideOffset={4}
            className="isolate z-50"
          >
            <Autocomplete.Popup className="relative isolate z-50 max-h-60 w-(--anchor-width) min-w-36 overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              <Autocomplete.List>
                {(item: PlaceSuggestion) => (
                  <Autocomplete.Item
                    key={item.placeId}
                    value={item}
                    className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    {item.text}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
      <input type="hidden" name={`${name}PlaceId`} value={placeId} />
    </>
  );
}
