export const FASES = [
  "lobby",
  "fase1_respondiendo",
  "fase1_muro",
  "entre_fases",
  "fase2",
  "derrumbe",
  "final",
] as const;

export type Fase = (typeof FASES)[number];

/** Datos públicos de una iglesia (el PIN nunca se expone al cliente). */
export type Iglesia = {
  id: string;
  slug: string;
  nombre: string;
  created_at: string;
};

export type LadrilloMuro = { id: string; texto: string };

export type Sesion = {
  id: string;
  iglesia_id: string;
  fase: Fase;
  pregunta_actual: number;
  entrada_abierta: boolean;
  activa: boolean;
  /** Foto de las respuestas visibles de fase 1 al momento de construir el muro. */
  muro: LadrilloMuro[] | null;
  muro_construido_at: string | null;
  /** Se incrementa en cada cambio de fase/pregunta (evita dobles clics entre líderes). */
  version: number;
  /** Se incrementa cuando cambian respuestas que Realtime no avisa (moderación, filtradas). */
  rev_respuestas: number;
  created_at: string;
  updated_at: string;
};

export type Respuesta = {
  id: string;
  sesion_id: string;
  iglesia_id: string;
  fase: 1 | 2;
  pregunta: number;
  texto: string;
  visible: boolean;
  filtrada: boolean;
  created_at: string;
};
