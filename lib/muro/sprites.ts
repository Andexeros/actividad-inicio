"use client";

import { crearRng } from "./layout";

/**
 * Dibuja cada ladrillo UNA vez en un canvas aparte (sprite) con su textura y su palabra.
 * Después, en cada cuadro, solo se copia la imagen rotada: así 200+ ladrillos van a 60 fps.
 */

const MORTERO = 3; // px de junta entre ladrillos

export type Sprite = { canvas: HTMLCanvasElement | OffscreenCanvas; w: number; h: number };

function lienzo(w: number, h: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Parte el texto en 1 o 2 líneas y busca el tamaño de letra más grande que entra. */
function ajustarTexto(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  texto: string,
  familia: string,
  maxW: number,
  maxH: number,
) {
  const palabras = texto.split(" ");
  const opciones: string[][] = [[texto]];
  for (let k = 1; k < palabras.length; k++) {
    opciones.push([palabras.slice(0, k).join(" "), palabras.slice(k).join(" ")]);
  }
  let mejor = { lineas: [texto], tam: 8 };
  for (const lineas of opciones) {
    let tam = Math.floor(maxH / (lineas.length === 1 ? 1 : 2.05));
    while (tam > 8) {
      ctx.font = `${tam}px ${familia}`;
      if (lineas.every((l) => ctx.measureText(l).width <= maxW)) break;
      tam--;
    }
    if (tam > mejor.tam) mejor = { lineas, tam };
  }
  return mejor;
}

export function crearSpriteLadrillo(opts: {
  w: number;
  h: number;
  texto: string | null;
  semilla: number;
  dpr: number;
  familia: string;
}): Sprite {
  const { texto, semilla, dpr, familia } = opts;
  const w = Math.max(4, opts.w - MORTERO);
  const h = Math.max(4, opts.h - MORTERO);
  const c = lienzo(Math.ceil(w * dpr), Math.ceil(h * dpr));
  const ctx = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  const rng = crearRng(semilla);

  // Color base terracota con variación por ladrillo
  const hue = 12 + rng() * 10;
  const sat = 52 + rng() * 14;
  const luz = (texto ? 40 : 33) + rng() * 9;
  const r = Math.min(4, h * 0.12);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `hsl(${hue} ${sat}% ${luz + 8}%)`);
  grad.addColorStop(0.55, `hsl(${hue} ${sat}% ${luz}%)`);
  grad.addColorStop(1, `hsl(${hue} ${sat + 4}% ${luz - 9}%)`);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // Textura: manchas y poros
  ctx.save();
  ctx.clip();
  const manchas = Math.round((w * h) / 140);
  for (let k = 0; k < manchas; k++) {
    const claro = rng() > 0.55;
    ctx.fillStyle = claro ? `hsl(${hue + 6} 70% ${luz + 18}% / ${0.08 + rng() * 0.12})` : `hsl(${hue} 60% 12% / ${0.1 + rng() * 0.18})`;
    const s = 0.6 + rng() * 2.2;
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
  // una mancha grande suave
  const mg = ctx.createRadialGradient(rng() * w, rng() * h, 0, rng() * w, rng() * h, w * 0.6);
  mg.addColorStop(0, `hsl(${hue} 50% 15% / 0.18)`);
  mg.addColorStop(1, "transparent");
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Bisel: luz arriba, sombra abajo
  ctx.fillStyle = "rgb(255 220 190 / 0.22)";
  ctx.fillRect(r, 0.5, w - 2 * r, Math.max(1, h * 0.06));
  ctx.fillStyle = "rgb(30 8 0 / 0.35)";
  ctx.fillRect(r, h - Math.max(1.5, h * 0.08), w - 2 * r, Math.max(1.5, h * 0.08));

  if (texto) {
    const { lineas, tam } = ajustarTexto(ctx, texto.toUpperCase(), familia, w * 0.86, h * 0.72);
    ctx.font = `${tam}px ${familia}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const alto = tam * 0.98;
    const y0 = h / 2 - ((lineas.length - 1) * alto) / 2 + tam * 0.05;
    lineas.forEach((l, k) => {
      ctx.fillStyle = "rgb(40 10 0 / 0.55)";
      ctx.fillText(l, w / 2 + 1, y0 + k * alto + 1.5);
      ctx.fillStyle = "#fff4ea";
      ctx.fillText(l, w / 2, y0 + k * alto);
    });
  }

  return { canvas: c, w, h };
}

/** Familia tipográfica real que cargó next/font para la display (Bebas Neue). */
export function familiaDisplay(): string {
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-bebas").trim();
  return v || "'Arial Narrow', sans-serif";
}
