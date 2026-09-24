/**
 * Shared top bar rendered by the root layout: brand mark (the wordmark
 * already says "car haus") plus the active session. A rider session shows
 * "Mis viajes" + email + logout; an admin session shows the admin email +
 * logout. Server component — reads cookies via `next/headers`.
 */

import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/auth";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";
import { LogoutButton } from "./logout-button";

export async function AppHeader() {
  const store = await cookies();
  const rider = await riderFromCookieValue(
    store.get(RIDER_COOKIE_NAME)?.value,
  );
  const admin = rider
    ? null
    : await verifyAdminSession(
          store.get(ADMIN_COOKIE_NAME)?.value ?? "",
        ).catch(() => null);

  return (
    <div className="flex items-center justify-between gap-4">
      <Link
        href={admin && !rider ? "/admin" : "/"}
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
          <Link
            href="/viajes"
            className="font-medium transition-colors duration-200 hover:text-muted-foreground"
          >
            Mis viajes
          </Link>
          <span className="hidden text-muted-foreground sm:inline">
            {rider.email}
          </span>
          <LogoutButton endpoint="/api/rider/logout" redirectTo="/" />
        </div>
      )}
      {!rider && !admin && (
        <Link
          href="/ingresar"
          className="text-sm font-medium transition-colors duration-200 hover:text-muted-foreground"
        >
          Ingresar
        </Link>
      )}
      {!rider && admin && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Admin · {admin.email}
          </span>
          <LogoutButton
            endpoint="/api/admin/logout"
            redirectTo="/admin/login"
          />
        </div>
      )}
    </div>
  );
}
