"use client";

import { useEffect, useRef } from "react";
import { actividad } from "@/config/actividad";
import { disenarMuro, hashTexto } from "@/lib/muro/layout";
import { MotorMuro } from "@/lib/muro/motor";
import { crearSpriteLadrillo, familiaDisplay } from "@/lib/muro/sprites";
import { reproducir } from "@/lib/sonidos";

type Props = {
  /** Identifica el muro (id de sesión). */
  claveMuro: string;
  textos: string[];
  /** true = construir ladrillo por ladrillo; false = aparecer completo (recarga). Solo cuenta al montar. */
  animar: boolean;
  onListo?: () => void;
};

/**
 * Canvas a pantalla completa con el muro. Si cambia el tamaño de la pantalla, se rearma
 * quieto (sin repetir la animación).
 */
export function MuroCanvas({ claveMuro, textos, animar, onListo }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const animarAlMontar = useRef(animar);
  const onListoRef = useRef(onListo);
  useEffect(() => {
    onListoRef.current = onListo;
  }, [onListo]);

  // El contenido del muro no cambia una vez construido (es una foto); lo fijamos al montar.
  const textosRef = useRef(textos);

  useEffect(() => {
    const div = contenedor.current;
    const cv = canvas.current;
    if (!div || !cv) return;
    let motor: MotorMuro | null = null;
    let cancelado = false;
    let primera = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function armar() {
      if (!div || !cv) return;
      const ancho = div.clientWidth;
      const alto = div.clientHeight;
      if (ancho < 50 || alto < 50) return;
      const familia = familiaDisplay();
      try {
        await document.fonts.load(`40px ${familia}`);
      } catch {
        // seguimos con la tipografía de respaldo
      }
      if (cancelado) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const layout = disenarMuro({
        textos: textosRef.current,
        minimo: actividad.muro.minimoLadrillos,
        ancho,
        alto,
        semilla: hashTexto(claveMuro),
      });
      const sprites = layout.ladrillos.map((l) =>
        crearSpriteLadrillo({ w: l.w, h: l.h, texto: l.texto, semilla: l.semilla, dpr, familia }),
      );
      const estabaConstruyendo = motor?.construyendo ?? false;
      motor?.destruir();
      motor = new MotorMuro(cv, layout, sprites, ancho, alto, dpr, {
        onApoyo: () => reproducir("ladrillo"),
        onFinConstruccion: () => onListoRef.current?.(),
      });
      if (process.env.NODE_ENV !== "production") {
        // Solo en desarrollo: acceso desde la consola para medir rendimiento
        (window as unknown as { __motorMuro?: MotorMuro }).__motorMuro = motor;
      }
      if (primera && animarAlMontar.current) {
        motor.construir(actividad.muro.msEntreLadrillos);
      } else {
        motor.colocarTodos();
        if (primera || estabaConstruyendo) onListoRef.current?.();
      }
      primera = false;
    }

    void armar();
    const ro = new ResizeObserver(() => {
      if (primera) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void armar(), 200);
    });
    ro.observe(div);
    return () => {
      cancelado = true;
      ro.disconnect();
      if (timer) clearTimeout(timer);
      motor?.destruir();
    };
  }, [claveMuro]);

  return (
    <div ref={contenedor} className="absolute inset-0">
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
