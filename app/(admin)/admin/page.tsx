/**
 * `/admin` landing after login — middleware already gates this path, but
 * re-verifying here keeps the page correct if the cookie expires between
 * the gate and render. The review queue lands in the next PR (Phase 8);
 * this page only proves the session round-trip works.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/auth";

export default async function AdminPage() {
  const store = await cookies();
  const session = await verifyAdminSession(
    store.get(ADMIN_COOKIE_NAME)?.value ?? "",
  ).catch(() => null);
  if (!session) redirect("/admin/login");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Carhaus · Admin
      </p>
      <h1 className="font-heading text-4xl font-bold tracking-tight">
        Sesión iniciada
      </h1>
      <p className="text-muted-foreground">
        {session.email} — la cola de viajes pendientes llega en el próximo
        PR.
      </p>
    </main>
  );
}
