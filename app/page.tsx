import { cookies } from "next/headers";
import { listTemplatesByRiderEmail } from "@/db/queries";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";
import { BookingSection } from "./_components/booking-section";

export default async function Home() {
  // Session-scoped template listing (spec): resolve the rider from the
  // `carhaus_rider` cookie; anonymous visitors just see the empty form.
  const store = await cookies();
  const rider = await riderFromCookieValue(
    store.get(RIDER_COOKIE_NAME)?.value,
  );
  const templates = rider
    ? await listTemplatesByRiderEmail(rider.email)
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Viajes privados · Mendoza
        </p>
        <h1 className="font-heading text-5xl font-bold tracking-tight sm:text-6xl">
          Tu viaje, a tu medida.
        </h1>
        <p className="max-w-md text-muted-foreground">
          Elegí tus snacks, tu playlist y la temperatura del aire. Sin
          intermediarios: hablás directo con quien te lleva.
        </p>
      </header>

      <hr className="border-border" />

      <BookingSection initialTemplates={templates} />
    </main>
  );
}
