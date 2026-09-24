"use client";

/**
 * Rider booking form (spec: "Rider Trip Request", "Price Preview", "Trip
 * Extras"). Mutations go through Route Handlers via `apiFetch` — no Server
 * Actions (design decision #2). `useActionState` still works because React
 * 19 accepts any async function as a form action (design "Client
 * Convention").
 *
 * The price preview is debounced off the leg fields; when the distance
 * provider is down the preview shows a fallback message but the rider can
 * still submit unpriced for admin review (spec: "Distance Provider
 * Failure Handling").
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api-client";

const PREVIEW_DEBOUNCE_MS = 700;

interface QuoteLeg {
  sequence: 1 | 2;
  origin: string;
  destination: string;
  scheduledAt: string;
  priceCents: number;
}

interface Preview {
  token: string;
  quote: { legs: QuoteLeg[]; totalPriceCents: number };
}

interface FormState {
  error?: string;
  fields?: Record<string, string[]>;
}

/** Pre-fill values from a saved template (spec: "Re-request Template" —
 * dates are never pre-filled: a re-request always re-runs the preview). */
export interface BookingInitial {
  origin: string;
  destination: string;
  roundTrip: boolean;
  snackChoice: string;
  spotifyPlaylistUrl?: string;
  acTemperatureCelsius?: number;
}

const SNACK_OPTIONS = [
  { value: "none", label: "Sin snack" },
  { value: "sweet", label: "Dulce" },
  { value: "salty", label: "Salado" },
  { value: "mixed", label: "Mixto" },
] as const;

const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function formatCents(cents: number): string {
  return priceFormatter.format(cents / 100);
}

export function BookingForm({ initial }: { initial?: BookingInitial }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [roundTrip, setRoundTrip] = useState(initial?.roundTrip ?? false);
  const [snackChoice, setSnackChoice] = useState<string>(
    initial?.snackChoice ?? "none",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [legsVersion, setLegsVersion] = useState(0);
  const bumpLegs = () => setLegsVersion((v) => v + 1);

  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const legs = buildLegs(formData, roundTrip);
      if (!legs) {
        return { error: "Completá origen, destino y fechas del viaje." };
      }
      try {
        const { publicToken } = await apiFetch<{ publicToken: string }>(
          "/api/trips",
          {
            body: {
              email: String(formData.get("email") ?? ""),
              quoteToken: preview?.token,
              legs,
              extras: {
                snackChoice,
                spotifyPlaylistUrl:
                  String(formData.get("spotifyPlaylistUrl") ?? "") || undefined,
                acTemperatureCelsius: formData.get("acTemperatureCelsius")
                  ? Number(formData.get("acTemperatureCelsius"))
                  : undefined,
              },
            },
          },
        );
        router.push(`/trips/${publicToken}`);
        return {};
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            error: error.message,
            fields: error.fields,
          };
        }
        return { error: "No pudimos enviar tu solicitud. Probá de nuevo." };
      }
    },
    {},
  );

  /** Debounced preview: re-quotes whenever the leg fields change. */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const legs = buildLegs(new FormData(form), roundTrip);
    if (!legs) {
      setPreview(null);
      setPreviewStatus("idle");
      return;
    }

    let cancelled = false;
    setPreviewStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<Preview>("/api/pricing/preview", {
          body: { legs },
        });
        if (!cancelled) {
          setPreview(data);
          setPreviewStatus("idle");
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewStatus("error");
        }
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // formData values are read through the ref; the inputs bump this via
    // onChange -> setLegsVersion.
  }, [roundTrip, legsVersion]);

  return (
    <form ref={formRef} action={formAction} className="w-full">
      <FieldGroup>
        <FieldSet>
          <FieldLegend className="font-heading text-lg font-semibold tracking-tight">
            Tu viaje
          </FieldLegend>
          <Field data-invalid={Boolean(state.fields?.email)}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="vos@ejemplo.com"
              autoComplete="email"
            />
            <FieldDescription>
              Te mandamos la confirmación del viaje acá.
            </FieldDescription>
            <FieldError>{state.fields?.email?.[0]}</FieldError>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(state.fields?.["legs.0.origin"])}>
              <FieldLabel htmlFor="origin">Origen</FieldLabel>
              <Input
                id="origin"
                name="origin"
                required
                defaultValue={initial?.origin}
                placeholder="Ej. Guaymallén"
                onChange={bumpLegs}
              />
              <FieldError>{state.fields?.["legs.0.origin"]?.[0]}</FieldError>
            </Field>
            <Field data-invalid={Boolean(state.fields?.["legs.0.destination"])}>
              <FieldLabel htmlFor="destination">Destino</FieldLabel>
              <Input
                id="destination"
                name="destination"
                required
                defaultValue={initial?.destination}
                placeholder="Ej. Plaza Shopping"
                onChange={bumpLegs}
              />
              <FieldError>
                {state.fields?.["legs.0.destination"]?.[0]}
              </FieldError>
            </Field>
          </div>

          <Field data-invalid={Boolean(state.fields?.["legs.0.scheduledAt"])}>
            <FieldLabel htmlFor="departAt">Fecha y hora de ida</FieldLabel>
            <Input
              id="departAt"
              name="departAt"
              type="datetime-local"
              required
              onChange={bumpLegs}
            />
            <FieldError>{state.fields?.["legs.0.scheduledAt"]?.[0]}</FieldError>
          </Field>

          <Field orientation="horizontal">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(
                [
                  { value: false, label: "Solo ida" },
                  { value: true, label: "Ida y vuelta" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setRoundTrip(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    roundTrip === opt.value
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {roundTrip && (
            <Field
              data-invalid={Boolean(state.fields?.["legs.1.scheduledAt"])}
            >
              <FieldLabel htmlFor="returnAt">Fecha y hora de vuelta</FieldLabel>
              <Input
                id="returnAt"
                name="returnAt"
                type="datetime-local"
                required={roundTrip}
                onChange={bumpLegs}
              />
              <FieldDescription>
                La vuelta es por el mismo recorrido, al revés.
              </FieldDescription>
              <FieldError>
                {state.fields?.["legs.1.scheduledAt"]?.[0]}
              </FieldError>
            </Field>
          )}
        </FieldSet>

        <FieldSet>
          <FieldLegend className="font-heading text-lg font-semibold tracking-tight">
            A tu medida
          </FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Snack</FieldLabel>
              <Select
                value={snackChoice}
                onValueChange={(value) => setSnackChoice(value ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SNACK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="acTemperatureCelsius">
                Aire acondicionado (°C)
              </FieldLabel>
              <Input
                id="acTemperatureCelsius"
                name="acTemperatureCelsius"
                type="number"
                min={16}
                max={30}
                defaultValue={initial?.acTemperatureCelsius}
                placeholder="22"
              />
            </Field>
          </div>
          <Field data-invalid={Boolean(state.fields?.["extras.spotifyPlaylistUrl"])}>
            <FieldLabel htmlFor="spotifyPlaylistUrl">
              Playlist de Spotify
            </FieldLabel>
            <Input
              id="spotifyPlaylistUrl"
              name="spotifyPlaylistUrl"
              type="url"
              defaultValue={initial?.spotifyPlaylistUrl}
              placeholder="https://open.spotify.com/playlist/..."
            />
            <FieldError>
              {state.fields?.["extras.spotifyPlaylistUrl"]?.[0]}
            </FieldError>
          </Field>
        </FieldSet>

        <PreviewPanel preview={preview} status={previewStatus} />

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Enviando…" : "Pedir viaje"}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** Reads the leg fields out of the form; returns null until the minimum
 *  required values for a preview are present. */
function buildLegs(
  formData: FormData,
  roundTrip: boolean,
): Array<{ origin: string; destination: string; scheduledAt: string }> | null {
  const origin = String(formData.get("origin") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  const departAt = String(formData.get("departAt") ?? "");
  if (!origin || !destination || !departAt) return null;

  const legs = [
    {
      origin,
      destination,
      scheduledAt: new Date(departAt).toISOString(),
    },
  ];

  if (roundTrip) {
    const returnAt = String(formData.get("returnAt") ?? "");
    // No preview/submit until the return time is set — a 1-leg quote must
    // never be paired with a 2-leg request.
    if (!returnAt) return null;
    legs.push({
      origin: destination,
      destination: origin,
      scheduledAt: new Date(returnAt).toISOString(),
    });
  }

  return legs;
}

function PreviewPanel({
  preview,
  status,
}: {
  preview: Preview | null;
  status: "idle" | "loading" | "error";
}) {
  if (status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Calculando precio estimado…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-border p-4 text-sm">
        <p className="font-medium">No pudimos calcular el precio ahora.</p>
        <p className="text-muted-foreground">
          Podés enviar la solicitud igual y te confirmamos el valor por mail.
        </p>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Precio estimado
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tracking-tight">
        {formatCents(preview.quote.totalPriceCents)}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {preview.quote.legs.map((leg) => (
          <li key={leg.sequence}>
            {leg.sequence === 1 ? "Ida" : "Vuelta"}:{" "}
            {formatCents(leg.priceCents)}
          </li>
        ))}
      </ul>
    </div>
  );
}
