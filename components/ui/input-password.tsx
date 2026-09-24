"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Input } from "./input";

/**
 * Password input with a visibility toggle. Same props as `Input` — `type`
 * is owned by the toggle. Form-compatible: stays uncontrolled, FormData
 * reads `name` as usual.
 */
function InputPassword({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        data-slot="input-password"
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export { InputPassword };
