"use client";

/** Clears the `carhaus_rider` cookie via the logout route, then reloads
 *  to the landing (the header disappears with the session). */

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await apiFetch("/api/rider/logout", { body: {} });
        } finally {
          window.location.href = "/";
        }
      }}
    >
      Salir
    </Button>
  );
}
