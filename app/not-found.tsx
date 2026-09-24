import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Este link no existe
        </h1>
        <p className="text-muted-foreground">
          El viaje que buscás no está — revisá que el link esté completo o
          pedí uno nuevo.
        </p>
      </div>
      <Button render={<Link href="/" />}>Volver al inicio</Button>
    </main>
  );
}
