import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** 6-digit OTP input — shown once a code was requested (or the caller
 *  already locked the email, meaning a request is on its way). */
export function CodeField() {
  return (
    <Field>
      <FieldLabel htmlFor="verify-code">Código</FieldLabel>
      <Input
        id="verify-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
      />
      <FieldDescription>
        Te mandamos un código de 6 dígitos — vence en 10 minutos.
      </FieldDescription>
    </Field>
  );
}
