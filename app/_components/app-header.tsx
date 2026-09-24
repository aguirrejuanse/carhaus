/**
 * Shared top bar: brand mark (the wordmark already says "car haus") and,
 * when a rider session cookie resolves, the rider's email + logout.
 * Server component — reads the cookie via `next/headers`.
 */

import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";
import { LogoutButton } from "./logout-button";

export async function AppHeader() {
  const store = await cookies();
  const rider = await riderFromCookieValue(
    store.get(RIDER_COOKIE_NAME)?.value,
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <Link
        href="/"
        className="transition-opacity duration-200 hover:opacity-80"
      >
        <Image
          src="/logo-header.png"
          alt="Carhaus"
          width={94}
          height={40}
          priority
        />
      </Link>
      {rider && (
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted-foreground sm:inline">
            {rider.email}
          </span>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}
