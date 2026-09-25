"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Algo salió mal
        </h1>
        <p className="text-muted-foreground">
          Tuvimos un problema cargando esta página. Probá de nuevo — si
          sigue, avisanos.
        </p>
      </div>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
