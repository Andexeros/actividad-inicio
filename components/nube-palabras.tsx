"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { familiaDisplay } from "@/lib/muro/sprites";
import { contarRespuestas, ubicarNube, type PalabraUbicada } from "@/lib/nube";

const COLORES = ["#ffc46b", "#f5ede6", "#f4c1a2", "#e07b4c", "#fff3d1"];

/** Nube de palabras que ocupa su contenedor. La usan la TV (final) y el admin. */
export function NubePalabras({
  textos,
  animar = true,
  tamMax,
}: {
  textos: string[];
  animar?: boolean;
  /** Tamaño máximo de letra en px (por defecto, relativo al alto). */
  tamMax?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tamano, setTamano] = useState<{ w: number; h: number } | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);
  const conteos = useMemo(() => contarRespuestas(textos), [textos]);

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    const familia = familiaDisplay();
    let vivo = true;
    document.fonts
      .load(`40px ${familia}`)
      .catch(() => {})
      .finally(() => vivo && setFuente(familia));
    const ro = new ResizeObserver(([e]) => {
      setTamano({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(div);
    return () => {
      vivo = false;
      ro.disconnect();
    };
  }, []);

  const palabras: PalabraUbicada[] = useMemo(() => {
    if (!tamano || !fuente || tamano.w < 50) return [];
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return [];
    const medir = (t: string, tam: number) => {
      ctx.font = `${tam}px ${fuente}`;
      return ctx.measureText(t.toUpperCase()).width;
    };
    return ubicarNube(conteos, tamano.w, tamano.h, medir, { tamMax });
  }, [conteos, tamano, fuente, tamMax]);

  return (
    <div ref={ref} className="relative h-full w-full">
      {conteos.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-foreground/50">Todavía no hay respuestas.</p>
      )}
      {palabras.map((p) => (
        <motion.span
          key={p.texto}
          initial={animar ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: animar ? Math.min(3, p.i * 0.06) : 0, type: "spring", stiffness: 220, damping: 20 }}
          title={`${p.texto} (${p.n})`}
          className="absolute whitespace-nowrap font-display uppercase leading-none"
          style={{
            left: p.x - p.w / 2,
            top: p.y - p.h / 2,
            fontSize: p.tam,
            lineHeight: `${p.h}px`,
            color: COLORES[p.i % COLORES.length],
            textShadow: p.i < 3 ? "0 0 0.4em rgb(255 196 107 / 0.45)" : undefined,
          }}
        >
          {p.texto}
        </motion.span>
      ))}
    </div>
  );
}
