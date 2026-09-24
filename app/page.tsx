import { BookingForm } from "./_components/booking-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Viajes privados · Mendoza
        </p>
        <h1 className="font-heading text-5xl font-bold tracking-tight sm:text-6xl">
          Tu viaje, a tu medida.
        </h1>
        <p className="max-w-md text-muted-foreground">
          Elegí tus snacks, tu playlist y la temperatura del aire. Sin
          intermediarios: hablás directo con quien te lleva.
        </p>
      </header>

      <hr className="border-border" />

      <BookingForm />
    </main>
  );
}
