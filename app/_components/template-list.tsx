"use client";

/** "Tus plantillas" — the rider's saved templates with a one-click
 *  "Repetir" that hands the template to the booking form as `initial`
 *  (dates intentionally stay empty so pricing re-runs). */

import type { TemplateItem } from "@/lib/services/templates";

interface Props {
  templates: TemplateItem[];
  onApply: (template: TemplateItem) => void;
}

export function TemplateList({ templates, onApply }: Props) {
  if (templates.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Tus plantillas
      </p>
      <ul className="divide-y divide-border border-y border-border">
        {templates.map((template) => (
          <li
            key={template.id}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="flex flex-col">
              <p className="font-medium">{template.name}</p>
              <p className="text-sm text-muted-foreground">
                {template.legs
                  .map((leg) => `${leg.origin} → ${leg.destination}`)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onApply(template)}
              className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90"
            >
              Repetir
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
