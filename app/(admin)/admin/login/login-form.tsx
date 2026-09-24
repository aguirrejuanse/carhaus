"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAdminLoginMutation } from "@/app/_hooks/use-admin-login-mutation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";

export function LoginForm() {
  const router = useRouter();
  const login = useAdminLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
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
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
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
