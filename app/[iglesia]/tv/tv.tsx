"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { actividad } from "@/config/actividad";
import { NubePalabras } from "@/components/nube-palabras";
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
  const { respuestas, cargadas } = useRespuestas(iglesia.id, sesion?.id ?? null, sesion?.rev_respuestas ?? 0);
  const conectados = usePresencia(iglesia.id);

  // ¿Vimos EN VIVO el paso a "muro construido"? Solo ahí se anima.
  // Si la TV se abre/recarga con el muro ya construido, aparece quieto.
  const [faseVista, setFaseVista] = useState(sesion?.fase);
  const [muroAnimadoDe, setMuroAnimadoDe] = useState<string | null>(null);
  const [muroListo, setMuroListo] = useState(false);
  // Igual con el derrumbe: explosión solo si se vio pasar de fase 2 a derrumbe
  const [derrumbeAnimadoDe, setDerrumbeAnimadoDe] = useState<string | null>(null);
  if (sesion?.fase !== faseVista) {
    setFaseVista(sesion?.fase);
    if (faseVista === "fase1_respondiendo" && sesion?.fase === "fase1_muro") {
      setMuroAnimadoDe(sesion.id);
      setMuroListo(false);
    }
    if (faseVista === "fase2" && sesion?.fase === "derrumbe") {
      setDerrumbeAnimadoDe(sesion.id);
    }
  }

  const textosFase2 = useMemo(() => respuestas.filter((r) => r.fase === 2).map((r) => r.texto), [respuestas]);
  const derrumbado = sesion?.fase === "derrumbe" || sesion?.fase === "final";
  const derrumbeAnimado = Boolean(sesion && derrumbeAnimadoDe === sesion.id);

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

      {/* Luz cálida detrás del muro: aparece con el derrumbe */}
      <AnimatePresence>
        {derrumbado && (
          <motion.div
            key="luz"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: derrumbeAnimado ? 2.5 : 0.6, delay: derrumbeAnimado ? 0.4 : 0 }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 50% at 50% 45%, rgb(255 196 107 / 0.42), rgb(200 96 47 / 0.18) 45%, transparent 75%)",
            }}
          />
        )}
      </AnimatePresence>

      {conMuro && sesion && (
        <motion.div
          className="absolute inset-0"
          // Con el versículo, los escombros quedan atenuados para que se lea bien
          animate={{ opacity: sesion.fase === "final" ? 0.18 : sesion.fase === "derrumbe" ? 0.38 : 1 }}
          transition={{ duration: 1.6, delay: sesion.fase === "derrumbe" && derrumbeAnimado ? 2.2 : 0 }}
        >
          <MuroCanvas
            key={sesion.id}
            claveMuro={sesion.id}
            textos={(sesion.muro ?? []).map((l) => l.texto)}
            animar={muroAnimadoDe === sesion.id}
            onListo={() => setMuroListo(true)}
            golpes={cargadas ? textosFase2 : null}
            derrumbado={derrumbado}
            derrumbeAnimado={derrumbeAnimado}
          />
        </motion.div>
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
          <Fase2 key="f2" iglesia={iglesia} abierta={Boolean(entrada)} cantidad={textosFase2.length} />
        ) : sesion.fase === "derrumbe" ? (
          <Versiculo key="versiculo" demora={derrumbeAnimado ? 2.4 : 0.3} />
        ) : sesion.fase === "final" ? (
          <Final key="final" textos={textosFase2} />
        ) : null}
      </AnimatePresence>

      {conexion === "desconectado" && (
        <p className="absolute bottom-4 right-4 z-40 rounded-lg bg-black/60 px-3 py-1.5 text-sm text-ladrillo-200">
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

function Fase2({ iglesia, abierta, cantidad }: { iglesia: Iglesia; abierta: boolean; cantidad: number }) {
  const meta = actividad.fase2.respuestasParaDerribar;
  const fuerza = Math.min(1, cantidad / meta);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease }}
      className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-[3vw] px-[4vw] pt-[3.5vh]"
    >
      <div className="flex max-w-[62vw] flex-col gap-[1.6vh]">
        <p className="text-[1.3vw] uppercase tracking-[0.35em] text-luz/90">Derribemos el muro</p>
        <h1 className="text-[2.4vw] font-extrabold leading-[1.1] text-balance drop-shadow-[0_0.2vw_1vw_rgb(0_0_0/0.9)]">
          {actividad.fase2.pregunta}
        </h1>
        <BarraFuerza fuerza={fuerza} cantidad={cantidad} />
      </div>
      {abierta && <QrIglesia slug={iglesia.slug} tamano="min(11vw, 22vh)" />}
    </motion.div>
  );
}

function BarraFuerza({ fuerza, cantidad }: { fuerza: number; cantidad: number }) {
  const pct = Math.round(fuerza * 100);
  return (
    <div className="mt-[0.6vh] w-[40vw]">
      <div className="mb-[0.6vh] flex items-baseline justify-between">
        <span className="font-display text-[1.9vw] tracking-wider text-foreground/80">Fuerza</span>
        <motion.span
          key={cantidad}
          initial={{ scale: 1.3, color: "#ffc46b" }}
          animate={{ scale: 1, color: "#f5ede6" }}
          className="font-display text-[2.4vw] tabular-nums"
        >
          {pct}%
        </motion.span>
      </div>
      <div className="relative h-[2.2vh] overflow-hidden rounded-full bg-black/70 ring-1 ring-foreground/30">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: "linear-gradient(90deg, #a84b22, #e07b4c 45%, #ffc46b 85%, #fff3d1)",
            boxShadow: "0 0 1.5vw rgb(255 196 107 / 0.7)",
          }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        />
      </div>
    </div>
  );
}

function Versiculo({ demora }: { demora: number }) {
  const { texto, cita } = actividad.fase2.versiculo;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="pointer-events-none absolute inset-0 flex items-start justify-center px-[10vw] pt-[16vh]"
    >
      <motion.blockquote
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: demora, duration: 2.2, ease }}
        className="text-center"
      >
        <p className="text-[3.6vw] font-bold leading-[1.25] text-balance text-foreground drop-shadow-[0_0.3vw_2vw_rgb(0_0_0/0.85)]">
          “{texto}”
        </p>
        <footer className="mt-[3vh] font-display text-[3vw] tracking-[0.15em] text-luz">{cita}</footer>
      </motion.blockquote>
    </motion.div>
  );
}

function Final({ textos }: { textos: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 flex flex-col px-[4vw] pb-[4vh] pt-[4vh]"
    >
      <p className="text-center text-[1.4vw] uppercase tracking-[0.35em] text-luz/90">
        Lo que vamos a hacer para derribar muros
      </p>
      <div className="relative mt-[2vh] flex-1">
        <NubePalabras textos={textos} />
      </div>
      <p className="text-center font-display text-[1.8vw] tracking-[0.15em] text-foreground/50">
        {actividad.fase2.versiculo.cita}
      </p>
    </motion.div>
  );
}
