/**
 * `/viajes` — the rider's trip history, reachable from the "Mis viajes"
 * header link. Session comes from the `carhaus_rider` cookie: anonymous
 * visitors get a pointer back to the booking form instead of a list
 * (there is no password login — a booking IS the sign-in).
 */

import { cookies } from "next/headers";
import Link from "next/link";
import { getTripsByUserId } from "@/db/queries";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";
import { AppHeader } from "@/app/_components/app-header";
import { TripList } from "@/app/_components/trip-list";
import { Button } from "@/components/ui/button";

export default async function RiderTripsPage() {
  const store = await cookies();
  const rider = await riderFromCookieValue(
    store.get(RIDER_COOKIE_NAME)?.value,
  );
  const trips = rider ? await getTripsByUserId(rider.userId) : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-10 sm:py-14">
      <AppHeader />
      <section className="flex flex-col gap-4">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Mis viajes
        </h1>
        {rider && trips.length > 0 ? (
          <TripList trips={trips} />
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-muted-foreground">
              {rider
                ? "Todavía no pediste ningún viaje."
                : "Pedí un viaje y tus solicitudes van a aparecer acá."}
            </p>
            <Button render={<Link href="/" />} variant="outline">
              Pedir un viaje
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
