import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Carhaus — Admin",
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Carhaus · Admin
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight">
          Ingresar
        </h1>
      </header>
      <LoginForm />
    </main>
  );
}
