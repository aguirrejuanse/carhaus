import { IngresarForm } from "./ingresar-form";

export default function IngresarPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Ingresar
        </h1>
        <p className="text-sm text-muted-foreground">
          Te mandamos un código a tu email — sin contraseña. Una vez
          verificado, ves tus viajes y plantillas.
        </p>
      </header>
      <IngresarForm />
    </main>
  );
}
