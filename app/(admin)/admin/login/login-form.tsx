"use client";

import { useRouter } from "next/navigation";
import { useAdminLoginMutation } from "@/app/_hooks/use-admin-login-mutation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputPassword } from "@/components/ui/input-password";
import { ApiError } from "@/lib/api/errors";

export function LoginForm() {
  const router = useRouter();
  const login = useAdminLoginMutation();
  const apiError = login.error instanceof ApiError ? login.error : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        login.mutate(
          {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
          },
          {
            onSuccess: () => {
              router.push("/admin");
              router.refresh();
            },
          },
        );
      }}
    >
      <FieldGroup>
        <Field data-invalid={Boolean(apiError?.fields?.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <FieldError>{apiError?.fields?.email?.[0]}</FieldError>
        </Field>
        <Field data-invalid={Boolean(apiError?.fields?.password)}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <InputPassword
            id="password"
            name="password"
            required
            autoComplete="current-password"
          />
          <FieldError>{apiError?.fields?.password?.[0]}</FieldError>
        </Field>

        {login.isError && (
          <p role="alert" className="text-sm text-destructive">
            {apiError?.status === 401
              ? "Email o contraseña incorrectos."
              : (apiError?.message ??
                "No pudimos iniciar sesión. Probá de nuevo.")}
          </p>
        )}

        <Button type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? "Ingresando…" : "Ingresar"}
        </Button>
      </FieldGroup>
    </form>
  );
}
