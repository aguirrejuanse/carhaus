"use client";

/**
 * App-level client providers. `QueryClient` is created inside `useState`
 * so every user/request gets its own cache (Next.js App Router docs
 * pattern — never a module-level singleton in a server-rendered app).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            // API mutations must not be silently retried — a retry could
            // double-book or double-notify; errors surface to the UI.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
