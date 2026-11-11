"use client";

import { useEffect, useRef } from "react";
import { actividad } from "@/config/actividad";
import { disenarMuro, hashTexto } from "@/lib/muro/layout";
import { MotorMuro } from "@/lib/muro/motor";
import { crearSpriteLadrillo, crearSpriteProyectil, familiaDisplay } from "@/lib/muro/sprites";
import { reproducir } from "@/lib/sonidos";

type Props = {
  /** Identifica el muro (id de sesión). */
  claveMuro: string;
  textos: string[];
  /** true = construir ladrillo por ladrillo; false = aparecer completo (recarga). Solo cuenta al montar. */
  animar: boolean;
  onListo?: () => void;
  /**
   * Respuestas de fase 2 en orden de llegada. `null` = todavía no se cargaron.
   * Las que ya estaban al cargar se aplican quietas (ladrillos ya caídos);
   * las que llegan después se lanzan como proyectiles.
   */
  golpes: string[] | null;
  derrumbado: boolean;
  /** true si el derrumbe se vio en vivo (explosión); false = ya estaba caído al abrir. */
  derrumbeAnimado: boolean;
};

/**
 * Canvas a pantalla completa con el muro. Si cambia el tamaño de la pantalla, se rearma
 * quieto (sin repetir animaciones), con los mismos golpes y derrumbe.
 */
export function MuroCanvas({ claveMuro, textos, animar, onListo, golpes, derrumbado, derrumbeAnimado }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<MotorMuro | null>(null);
  const animarAlMontar = useRef(animar);
  const onListoRef = useRef(onListo);
  const estado = useRef({ golpes, derrumbado, derrumbeAnimado });
  /** ¿Ya se aplicaron quietos los golpes que había al cargar? */
  const inicialAplicado = useRef(false);
  useEffect(() => {
    onListoRef.current = onListo;
    estado.current = { golpes, derrumbado, derrumbeAnimado };
  });

  // El contenido del muro no cambia una vez construido (es una foto); lo fijamos al montar.
  const textosRef = useRef(textos);

  useEffect(() => {
    const div = contenedor.current;
    const cv = canvas.current;
    if (!div || !cv) return;
    let cancelado = false;
    let primera = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** Tamaño con el que se armó el muro actual (para ignorar avisos sin cambio real). */
    let armadoCon = { ancho: 0, alto: 0 };

    async function armar() {
      if (!div || !cv) return;
      const ancho = div.clientWidth;
      const alto = div.clientHeight;
      if (ancho < 50 || alto < 50) return;
      armadoCon = { ancho, alto };
      const familia = familiaDisplay();
      try {
        await document.fonts.load(`40px ${familia}`);
      } catch {
        // seguimos con la tipografía de respaldo
      }
      if (cancelado) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const semilla = hashTexto(claveMuro);
      const layout = disenarMuro({
        textos: textosRef.current,
        minimo: actividad.muro.minimoLadrillos,
        ancho,
        alto,
        semilla,
      });
      const sprites = layout.ladrillos.map((l) =>
        crearSpriteLadrillo({ w: l.w, h: l.h, texto: l.texto, semilla: l.semilla, dpr, familia }),
      );
      const anterior = motorRef.current;
      const estabaConstruyendo = anterior?.construyendo ?? false;
      const golpesPrevios = anterior?.cantidadGolpes ?? 0;
      anterior?.destruir();
      const altoProyectil = Math.max(26, Math.min(alto * 0.07, layout.altoLadrillo * 1.1));
      const motor = new MotorMuro(
        cv,
        layout,
        sprites,
        ancho,
        alto,
        dpr,
        {
          onApoyo: () => reproducir("ladrillo"),
          onFinConstruccion: () => onListoRef.current?.(),
          onImpacto: () => reproducir("impacto", { variar: 0.08 }),
        },
        semilla,
        (texto) => crearSpriteProyectil({ texto, alto: altoProyectil, dpr, familia }),
      );
      motorRef.current = motor;
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
      // Al rearmar (o al abrir la TV ya en fase 2), todo lo previo aparece quieto
      const { golpes: g, derrumbado: d } = estado.current;
      if (g) {
        motor.aplicarGolpesQuietos(primera ? g.length : Math.max(golpesPrevios, g.length));
        inicialAplicado.current = true;
      }
      if (d) motor.derrumbar(false);
      primera = false;
    }

    void armar();
    // ResizeObserver avisa siempre una vez al empezar: solo rearmamos si el tamaño cambió de verdad
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (primera) return;
        if (Math.abs(div.clientWidth - armadoCon.ancho) < 2 && Math.abs(div.clientHeight - armadoCon.alto) < 2) return;
        void armar();
      }, 200);
    });
    ro.observe(div);
    return () => {
      cancelado = true;
      ro.disconnect();
      if (timer) clearTimeout(timer);
      motorRef.current?.destruir();
      motorRef.current = null;
    };
  }, [claveMuro]);

  // Golpes nuevos → proyectiles
  useEffect(() => {
    const motor = motorRef.current;
    if (!motor || !golpes) return;
    if (!inicialAplicado.current) {
      motor.aplicarGolpesQuietos(golpes.length);
      inicialAplicado.current = true;
      return;
    }
    for (let k = motor.cantidadGolpes; k < golpes.length; k++) motor.golpear(golpes[k]);
  }, [golpes]);

  // Derrumbe en vivo
  useEffect(() => {
    const motor = motorRef.current;
    if (!motor || !derrumbado || motor.estaDerrumbado) return;
    motor.derrumbar(derrumbeAnimado);
    if (derrumbeAnimado) reproducir("derrumbe", { variar: 0 });
  }, [derrumbado, derrumbeAnimado]);

  return (
    <div ref={contenedor} className="absolute inset-0">
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
