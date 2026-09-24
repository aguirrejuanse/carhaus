"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api-client";

interface FormState {
  error?: string;
  fields?: Record<string, string[]>;
}

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      try {
        await apiFetch("/api/admin/login", {
          body: {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
          },
        });
        router.push("/admin");
        router.refresh();
        return {};
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            error:
              error.status === 401
                ? "Email o contraseña incorrectos."
                : error.message,
            fields: error.fields,
          };
        }
        return { error: "No pudimos iniciar sesión. Probá de nuevo." };
      }
    },
    {},
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={Boolean(state.fields?.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <FieldError>{state.fields?.email?.[0]}</FieldError>
        </Field>
        <Field data-invalid={Boolean(state.fields?.password)}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <FieldError>{state.fields?.password?.[0]}</FieldError>
        </Field>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Ingresando…" : "Ingresar"}
        </Button>
      </FieldGroup>
    </form>
  );
}
