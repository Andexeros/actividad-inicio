"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { actividad } from "@/config/actividad";
import { ControlesTv } from "@/components/tv/controles";
import { QrIglesia } from "@/components/tv/qr";
import { entradaActual } from "@/lib/fases";
import { usePresencia } from "@/lib/presencia";
import { useRespuestas, useSesionActiva } from "@/lib/realtime";
import type { Fase, Iglesia, Sesion } from "@/lib/types";

// Matter.js y el canvas solo en el navegador
const MuroCanvas = dynamic(() => import("@/components/tv/muro-canvas").then((m) => m.MuroCanvas), {
  ssr: false,
});

const FASES_CON_MURO: Fase[] = ["fase1_muro", "entre_fases", "fase2", "derrumbe", "final"];
const ease = [0.22, 1, 0.36, 1] as const;

export function Tv({ iglesia, sesionInicial }: { iglesia: Iglesia; sesionInicial: Sesion | null }) {
  const { sesion, conexion } = useSesionActiva(iglesia.id, sesionInicial);
  const { respuestas } = useRespuestas(iglesia.id, sesion?.id ?? null, sesion?.rev_respuestas ?? 0);
  const conectados = usePresencia(iglesia.id);

  // ¿Vimos EN VIVO el paso a "muro construido"? Solo ahí se anima.
  // Si la TV se abre/recarga con el muro ya construido, aparece quieto.
  const [faseVista, setFaseVista] = useState(sesion?.fase);
  const [muroAnimadoDe, setMuroAnimadoDe] = useState<string | null>(null);
  const [muroListo, setMuroListo] = useState(false);
  if (sesion?.fase !== faseVista) {
    setFaseVista(sesion?.fase);
    if (faseVista === "fase1_respondiendo" && sesion?.fase === "fase1_muro") {
      setMuroAnimadoDe(sesion.id);
      setMuroListo(false);
    }
  }

  const conMuro = sesion && FASES_CON_MURO.includes(sesion.fase);
  const entrada = sesion ? entradaActual(sesion) : null;
  const cantidadPregunta =
    sesion?.fase === "fase1_respondiendo"
      ? respuestas.filter((r) => r.fase === 1 && r.pregunta === sesion.pregunta_actual).length
      : 0;

  return (
    <main className="relative h-dvh w-full flex-1 overflow-hidden bg-background text-foreground select-none">
      {/* Luz cálida de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 100%, rgb(200 96 47 / 0.28), transparent 70%), radial-gradient(ellipse 50% 40% at 50% 0%, rgb(255 196 107 / 0.06), transparent 70%)",
        }}
      />

      {conMuro && sesion && (
        <MuroCanvas
          key={sesion.id}
          claveMuro={sesion.id}
          textos={(sesion.muro ?? []).map((l) => l.texto)}
          animar={muroAnimadoDe === sesion.id}
          onListo={() => setMuroListo(true)}
        />
      )}

      <AnimatePresence mode="wait">
        {!sesion ? (
          <Centro key="sin">
            <p className="text-[3vw] text-foreground/60">No hay una sesión activa para {iglesia.nombre}.</p>
          </Centro>
        ) : sesion.fase === "lobby" ? (
          <Lobby key="lobby" iglesia={iglesia} conectados={conectados} />
        ) : sesion.fase === "fase1_respondiendo" ? (
          <Pregunta
            key={`p-${sesion.pregunta_actual}`}
            iglesia={iglesia}
            numero={sesion.pregunta_actual}
            abierta={sesion.entrada_abierta}
            cantidad={cantidadPregunta}
          />
        ) : sesion.fase === "fase1_muro" ? (
          <Reflexion key="reflexion" visible={muroListo || muroAnimadoDe !== sesion.id} />
        ) : sesion.fase === "fase2" ? (
          // Etapa 5: proyectiles, barra de fuerza y derrumbe
          <Fase2Provisoria key="f2" iglesia={iglesia} abierta={Boolean(entrada)} />
        ) : null}
      </AnimatePresence>

      {conexion === "desconectado" && (
        <p className="absolute right-4 top-4 z-40 rounded-lg bg-black/60 px-3 py-1.5 text-sm text-ladrillo-200">
          Reconectando…
        </p>
      )}
      <ControlesTv />
    </main>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {children}
    </motion.div>
  );
}

function Lobby({ iglesia, conectados }: { iglesia: Iglesia; conectados: number }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 grid grid-cols-[1.15fr_1fr] items-center gap-[4vw] px-[6vw]"
    >
      <div>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease }}
          className="text-[1.6vw] uppercase tracking-[0.35em] text-ladrillo-200/80"
        >
          {iglesia.nombre}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease }}
          className="font-display text-[13vw] leading-[0.85] tracking-wide text-ladrillo-400 drop-shadow-[0_0.4vw_3vw_rgb(200_96_47/0.35)]"
        >
          {actividad.titulo}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-[1.5vw] max-w-[40vw] text-[2vw] leading-snug text-foreground/75"
        >
          {actividad.subtitulo}
        </motion.p>
        <div className="mt-[3vw] flex items-baseline gap-[1vw]">
          <motion.span
            key={conectados}
            initial={{ scale: 1.3, color: "#ffc46b" }}
            animate={{ scale: 1, color: "#f5ede6" }}
            className="font-display text-[6vw] leading-none tabular-nums"
          >
            {conectados}
          </motion.span>
          <span className="text-[1.8vw] text-foreground/60">{conectados === 1 ? "conectado" : "conectados"}</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8, ease }}
        className="flex flex-col items-center gap-[1.2vw]"
      >
        <p className="text-[1.8vw] font-semibold text-foreground/80">Escaneá para participar</p>
        <QrIglesia slug={iglesia.slug} tamano="min(30vw, 58vh)" />
      </motion.div>
    </motion.section>
  );
}

function Pregunta({
  iglesia,
  numero,
  abierta,
  cantidad,
}: {
  iglesia: Iglesia;
  numero: number;
  abierta: boolean;
  cantidad: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.6, ease }}
      className="absolute inset-0 flex flex-col px-[6vw] pb-[4vw] pt-[5vw]"
    >
      <p className="text-[1.6vw] uppercase tracking-[0.35em] text-ladrillo-200/80">
        Pregunta {numero + 1} de {actividad.fase1.preguntas.length}
      </p>
      <h1 className="mt-[1.5vw] max-w-[80vw] text-[4.4vw] font-extrabold leading-[1.1] text-balance">
        {actividad.fase1.preguntas[numero]}
      </h1>
      <div className="mt-auto flex items-end justify-between">
        <div>
          <motion.p
            key={cantidad}
            initial={{ scale: 1.25, color: "#ffc46b" }}
            animate={{ scale: 1, color: "#f5ede6" }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="origin-bottom-left font-display text-[14vw] leading-[0.8] tabular-nums"
          >
            {cantidad}
          </motion.p>
          <p className="mt-[0.8vw] text-[2vw] text-foreground/60">
            {cantidad === 1 ? "respuesta" : "respuestas"}
          </p>
        </div>
        {abierta ? (
          <QrIglesia slug={iglesia.slug} tamano="min(15vw, 30vh)" />
        ) : (
          <p className="rounded-[1vw] border border-foreground/20 px-[2vw] py-[1vw] text-[2vw] text-foreground/70">
            Respuestas cerradas
          </p>
        )}
      </div>
    </motion.section>
  );
}

function Reflexion({ visible }: { visible: boolean }) {
  return (
    <motion.div exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[5vh] flex justify-center">
      <AnimatePresence>
        {visible && (
          <motion.h2
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.6, ease }}
            className="px-[4vw] text-center font-display text-[7vw] leading-none tracking-wide text-foreground drop-shadow-[0_0.3vw_2vw_rgb(0_0_0/0.8)]"
          >
            {actividad.fase1.reflexion}
          </motion.h2>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Fase2Provisoria({ iglesia, abierta }: { iglesia: Iglesia; abierta: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-x-0 top-0 flex items-start justify-between gap-[3vw] px-[4vw] pt-[3vh]"
    >
      <h1 className="max-w-[60vw] text-[3vw] font-extrabold leading-tight drop-shadow-[0_0.2vw_1vw_rgb(0_0_0/0.9)]">
        {actividad.fase2.pregunta}
      </h1>
      {abierta && <QrIglesia slug={iglesia.slug} tamano="min(11vw, 22vh)" />}
    </motion.div>
  );
}
