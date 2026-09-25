"use client";

/**
 * Guided tour (driver.js) — launched only from the "¿Cómo funciona?"
 * button; never auto-runs (intrusive on mobile). Steps highlight
 * `data-tour` attributes; steps whose element isn't rendered (empty
 * preview, no templates, logged-in header) are skipped.
 */

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const steps: DriveStep[] = [
  {
    element: "[data-tour='trip']",
    popover: {
      title: "Tu viaje",
      description:
        "Contanos de dónde a dónde y cuándo. Con \"Ida y vuelta\" te traemos de regreso por el mismo recorrido.",
      side: "top",
    },
  },
  {
    element: "[data-tour='extras']",
    popover: {
      title: "A tu medida",
      description:
        "Snacks, tu playlist de Spotify y la temperatura del aire — el viaje se arma como querés.",
      side: "top",
    },
  },
  {
    element: "[data-tour='preview']",
    popover: {
      title: "Precio al instante",
      description:
        "Apenas completás origen y destino calculamos el precio con la distancia real del recorrido.",
      side: "top",
    },
  },
  {
    element: "[data-tour='submit']",
    popover: {
      title: "Pedí tu viaje",
      description:
        "Te mandamos un código a tu email para confirmarlo — sin contraseñas. Tu solicitud queda en revisión y te avisamos por email.",
      side: "top",
    },
  },
  {
    element: "[data-tour='templates']",
    popover: {
      title: "Tus plantillas",
      description:
        "Los viajes que repetís se pueden guardar: un click en \"Repetir\" y el formulario se completa solo.",
      side: "bottom",
    },
  },
  {
    element: "[data-tour='login']",
    popover: {
      title: "Tu cuenta",
      description:
        "Ingresá con tu email para ver tus viajes y plantillas desde cualquier dispositivo.",
      side: "bottom",
    },
  },
];

export function startDemoTour() {
  // Skip steps whose element isn't rendered (empty preview, no
  // templates) — a centered popover for a missing target reads as noise.
  const present = steps.filter(
    (step) =>
      typeof step.element !== "string" ||
      document.querySelector(step.element),
  );
  // driver.js measures the highlight box once per step — the target can
  // still grow (the round-trip toggle mounts the return input inside the
  // same wrapper), so we refresh on any subtree mutation.
  let observer: MutationObserver | undefined;
  let activeElement: Element | undefined;
  const d = driver({
    showProgress: true,
    popoverClass: "carhaus-tour",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Listo",
    steps: present,
    onHighlightStarted: (element) => {
      observer?.disconnect();
      activeElement = element;
      if (!element) return;
      observer = new MutationObserver(() => d.refresh());
      observer.observe(element, { childList: true, subtree: true });
    },
    onDestroyed: () => {
      observer?.disconnect();
      document.removeEventListener("pointerdown", dismiss);
    },
  });

  // Dismiss on clicks outside the popover, the highlighted element,
  // and lifted portals — typing or picking a suggestion must not kill
  // the tour, but a click on the dimmed page hands control back.
  const dismiss = (event: PointerEvent) => {
    const target = event.target as Element;
    if (target.closest?.(".driver-popover")) return;
    if (target.closest?.(".tour-lift")) return;
    if (activeElement?.contains(target)) return;
    d.destroy();
  };
  document.addEventListener("pointerdown", dismiss);

  d.drive();
}
