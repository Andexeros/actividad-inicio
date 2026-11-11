"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { precargarSonidos, silenciar } from "@/lib/sonidos";

function suscribirFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

/**
 * Botones de pantalla completa y sonido (abajo a la izquierda). Se esconden solos,
 * junto con el cursor, después de 3 s sin mover el mouse.
 */
export function ControlesTv() {
  const [visible, setVisible] = useState(true);
  const [sonido, setSonido] = useState(false);
  const pantallaCompleta = useSyncExternalStore(
    suscribirFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false,
  );

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setVisible(true);
      clearTimeout(t);
      t = setTimeout(() => setVisible(false), 3000);
    };
    mostrar();
    window.addEventListener("mousemove", mostrar);
    window.addEventListener("keydown", mostrar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", mostrar);
      window.removeEventListener("keydown", mostrar);
    };
  }, []);

  // Que la pantalla no se apague ni se bloquee durante la actividad (Screen Wake Lock).
  // El navegador lo suelta al cambiar de pestaña: se vuelve a pedir al volver.
  useEffect(() => {
    let bloqueo: WakeLockSentinel | null = null;
    async function pedir() {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        bloqueo = await navigator.wakeLock.request("screen");
      } catch {
        // sin permiso o no soportado: la TV sigue funcionando igual
      }
    }
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      void bloqueo?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    document.body.style.cursor = visible ? "" : "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, [visible]);

  async function activarSonido(activo: boolean) {
    await precargarSonidos();
    await silenciar(!activo);
    setSonido(activo);
  }

  async function alternarPantalla() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen().catch(() => {});
      // el clic sirve también para habilitar el audio
      if (!sonido) await activarSonido(true);
    }
  }

  return (
    <AnimatePresence>
      {(visible || !sonido) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-2"
        >
          <button
            type="button"
            onClick={() => void alternarPantalla()}
            className="rounded-xl bg-black/60 px-4 py-2 text-sm text-foreground/80 backdrop-blur hover:bg-black/80"
          >
            {pantallaCompleta ? "Salir de pantalla completa" : "⛶ Pantalla completa"}
          </button>
          <button
            type="button"
            onClick={() => void activarSonido(!sonido)}
            className={`rounded-xl px-4 py-2 text-sm backdrop-blur ${
              sonido ? "bg-black/60 text-foreground/80 hover:bg-black/80" : "animate-pulse bg-ladrillo-500 text-ladrillo-50"
            }`}
          >
            {sonido ? "🔊 Sonido" : "🔇 Activar sonido"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
