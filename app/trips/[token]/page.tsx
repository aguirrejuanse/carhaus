/**
 * Rider confirmation page (design decision #8: unguessable public link —
 * `trips.publicToken`, no auth required). Read-only: approved trips are
 * immutable per spec "Trip Immutability", and there is no edit surface for
 * pending ones either.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripByPublicToken } from "@/db/queries";
import { AppHeader } from "@/app/_components/app-header";
import { RiderTrips } from "@/app/_components/rider-trips";
import { Button } from "@/components/ui/button";
import { ConfirmationHeader } from "./confirmation-header";
import { TripSummary } from "./trip-summary";

export default async function TripConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getTripByPublicToken(token);
  if (!trip) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-10 sm:py-14">
      <AppHeader />
      <ConfirmationHeader status={trip.status} email={trip.user.email} />
      <hr className="border-border" />
      <TripSummary
        legs={trip.legs}
        totalPriceCents={trip.totalPriceCents}
        extras={trip.extras}
      />
      <Button
        render={<Link href="/" />}
        variant="outline"
        className="w-fit"
      >
        Pedir otro viaje
      </Button>
      <hr className="border-border" />
      <RiderTrips />
    </main>
  );
}
