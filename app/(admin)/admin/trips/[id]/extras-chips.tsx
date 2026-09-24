import { SNACK_LABELS } from "@/lib/labels";
import type { tripExtras } from "@/db/schema";

type Extras = typeof tripExtras.$inferSelect;

const chipClass =
  "rounded-md bg-accent px-2 py-1 text-accent-foreground";

export function ExtrasChips({ extras }: { extras: Extras | null | undefined }) {
  if (!extras) return null;
  return (
    <>
      <span className={chipClass}>
        {SNACK_LABELS[extras.snackChoice] ?? extras.snackChoice}
      </span>
      {extras.acTemperatureCelsius != null && (
        <span className={chipClass}>
          Aire {extras.acTemperatureCelsius}°C
        </span>
      )}
      {extras.spotifyPlaylistUrl && (
        <a
          href={extras.spotifyPlaylistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${chipClass} underline`}
        >
          Playlist
        </a>
      )}
    </>
  );
}
