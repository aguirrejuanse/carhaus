"use client";

/**
 * First-visit guided tour (driver.js) — runs once per browser via
 * localStorage, with `startDemoTour` exported for a manual replay.
 * Steps highlight `data-tour` attributes; a step whose element isn't
 * rendered (e.g. templates for anonymous riders) shows centered.
 */

import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "carhaus-demo-tour-seen";

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
  driver({
    showProgress: true,
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Listo",
    steps,
  }).drive();
}

export function useDemoTour() {
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;
    // Let the page settle (fonts, template list) before highlighting.
    const timer = setTimeout(() => {
      startDemoTour();
      localStorage.setItem(TOUR_KEY, "1");
    }, 600);
    return () => clearTimeout(timer);
  }, []);
}
