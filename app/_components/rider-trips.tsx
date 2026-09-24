/**
 * "Tus viajes" — the rider's recent trips on the confirmation page, so a
 * returning rider can jump back to any request. Server component: reads
 * the `carhaus_rider` cookie, renders nothing when anonymous or empty.
 */

import { cookies } from "next/headers";
import { getTripsByUserId } from "@/db/queries";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";
import { TripList } from "./trip-list";

export async function RiderTrips() {
  const store = await cookies();
  const rider = await riderFromCookieValue(
    store.get(RIDER_COOKIE_NAME)?.value,
  );
  if (!rider) return null;

  const trips = await getTripsByUserId(rider.userId);
  if (trips.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Tus viajes
      </h2>
      <TripList trips={trips} />
    </section>
  );
}
