"use client";

import type { Howl as HowlType } from "howler";

/**
 * Sonidos de la TV (Howler). Se cargan bajo demanda en el navegador.
 * Los navegadores bloquean el audio hasta que alguien hace clic en la página:
 * por eso la TV tiene el botón "Activar sonido" / pantalla completa.
 */

export type NombreSonido = "ladrillo" | "impacto" | "derrumbe";

const ARCHIVOS: Record<NombreSonido, { src: string; volumen: number; pool: number }> = {
  ladrillo: { src: "/sounds/ladrillo.wav", volumen: 0.55, pool: 12 },
  impacto: { src: "/sounds/impacto.wav", volumen: 0.85, pool: 6 },
  derrumbe: { src: "/sounds/derrumbe.wav", volumen: 1, pool: 2 },
};

const sonidos = new Map<NombreSonido, HowlType>();
const ultimo = new Map<NombreSonido, number>();
let cargando: Promise<void> | null = null;

export function precargarSonidos(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  cargando ??= import("howler").then(({ Howl }) => {
    for (const [nombre, a] of Object.entries(ARCHIVOS) as [NombreSonido, (typeof ARCHIVOS)[NombreSonido]][]) {
      sonidos.set(nombre, new Howl({ src: [a.src], volume: a.volumen, pool: a.pool, preload: true }));
    }
  });
  return cargando;
}

/** Reproduce con variación de tono; ignora repeticiones muy seguidas (máx. ~25 por segundo). */
export function reproducir(nombre: NombreSonido, opciones: { variar?: number; volumen?: number } = {}) {
  const s = sonidos.get(nombre);
  if (!s) return;
  const ahora = performance.now();
  if (ahora - (ultimo.get(nombre) ?? 0) < 40) return;
  ultimo.set(nombre, ahora);
  const id = s.play();
  const v = opciones.variar ?? 0.12;
  s.rate(1 - v + Math.random() * v * 2, id);
  if (opciones.volumen !== undefined) s.volume(opciones.volumen, id);
}

export async function silenciar(mudo: boolean) {
  await precargarSonidos();
  const { Howler } = await import("howler");
  Howler.mute(mudo);
}

/** true si el navegador ya permite reproducir audio (hubo un clic en la página). */
export async function audioDesbloqueado(): Promise<boolean> {
  await precargarSonidos();
  const { Howler } = await import("howler");
  return Howler.ctx?.state === "running";
}
