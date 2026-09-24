"use client";

/** Clears a session cookie via its logout route, then navigates to the
 *  given destination (the header disappears with the session). */

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface LogoutButtonProps {
  endpoint: string;
  redirectTo: string;
}

export function LogoutButton({ endpoint, redirectTo }: LogoutButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await apiFetch(endpoint, { body: {} });
        } finally {
          window.location.href = redirectTo;
        }
      }}
    >
      Salir
    </Button>
  );
}
