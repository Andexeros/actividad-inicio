"use client";

import { useSyncExternalStore } from "react";

const CLAVE_ID = "elmuro:dispositivo";

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // modo privado / almacenamiento bloqueado: seguimos sin guardar
  }
}

let idEnMemoria: string | null = null;

/** Id anónimo del celular (no identifica a la persona; solo sirve para el rate limit). */
export function idDispositivo(): string {
  if (idEnMemoria) return idEnMemoria;
  let id = leer(CLAVE_ID);
  if (!id || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    escribir(CLAVE_ID, id);
  }
  idEnMemoria = id;
  return id;
}

function claveEnviadas(sesionId: string, fase: number, pregunta: number) {
  return `elmuro:enviadas:${sesionId}:${fase}:${pregunta}`;
}

const EVENTO = "elmuro:enviadas";

function enviadasLocal(sesionId: string, fase: number, pregunta: number): number {
  if (typeof window === "undefined") return 0;
  return Number(leer(claveEnviadas(sesionId, fase, pregunta)) ?? 0) || 0;
}

export function guardarEnviadasLocal(sesionId: string, fase: number, pregunta: number, n: number) {
  escribir(claveEnviadas(sesionId, fase, pregunta), String(n));
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Cuántas respuestas mandó este celular para la pregunta (guardado en localStorage). */
export function useEnviadasLocal(sesionId: string, fase: number, pregunta: number): number {
  return useSyncExternalStore(
    suscribir,
    () => enviadasLocal(sesionId, fase, pregunta),
    () => 0,
  );
}
