/**
 * Diseño del muro: dónde va cada ladrillo. Puro y determinístico:
 * la misma foto de respuestas + el mismo tamaño de pantalla dan siempre el mismo muro
 * (así la TV lo reconstruye igual al recargar).
 */

export type LadrilloLayout = {
  /** Índice estable dentro del muro (orden de caída). */
  i: number;
  x: number; // centro
  y: number; // centro
  w: number;
  h: number;
  fila: number;
  texto: string | null;
  /** Semilla para variar color/textura de este ladrillo. */
  semilla: number;
  medio: boolean;
};

export type MuroLayout = {
  ladrillos: LadrilloLayout[];
  piso: number;
  arriba: number; // y del borde superior del muro
  ancho: number;
  izquierda: number;
  anchoLadrillo: number;
  altoLadrillo: number;
};

/** PRNG chico y rápido (mulberry32). */
export function crearRng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PROPORCION = 2.4; // ancho / alto de un ladrillo

/** Lugares "enteros" (donde puede ir texto) en R filas de C columnas con aparejo desplazado. */
function lugaresEnteros(filas: number, columnas: number) {
  let total = 0;
  for (let f = 0; f < filas; f++) total += f % 2 === 0 ? columnas : columnas - 1;
  return total;
}

export function disenarMuro(opts: {
  textos: string[];
  minimo: number;
  ancho: number; // viewport en px CSS
  alto: number;
  semilla: number;
  /** Fracción del alto que puede ocupar el muro. */
  altoMax?: number;
}): MuroLayout {
  const { textos, minimo, ancho, alto, semilla } = opts;
  const rng = crearRng(semilla);
  const necesarios = Math.max(textos.length, minimo, 1);

  const anchoUtil = ancho * 0.9;
  const altoUtil = alto * (opts.altoMax ?? 0.74);
  const piso = alto - alto * 0.035;

  // La mayor cantidad de columnas posible que todavía entre: elegimos el ladrillo más grande
  let columnas = 40;
  let filas = 1;
  for (let c = 4; c <= 40; c++) {
    const w = anchoUtil / c;
    const h = w / PROPORCION;
    let r = 1;
    while (lugaresEnteros(r, c) < necesarios) r++;
    if (r * h <= altoUtil) {
      columnas = c;
      filas = r;
      break;
    }
  }
  if (lugaresEnteros(filas, columnas) < necesarios) {
    while (lugaresEnteros(filas, columnas) < necesarios) filas++;
  }

  let w = anchoUtil / columnas;
  let h = w / PROPORCION;
  if (filas * h > altoUtil) {
    // caso extremo (muchísimas respuestas): achicar para que entre en alto
    h = altoUtil / filas;
    w = h * PROPORCION;
  }
  const anchoMuro = columnas * w;
  const izquierda = (ancho - anchoMuro) / 2;

  type Lugar = Omit<LadrilloLayout, "i" | "texto" | "semilla">;
  const lugares: Lugar[] = [];
  for (let f = 0; f < filas; f++) {
    const y = piso - (f + 0.5) * h;
    if (f % 2 === 0) {
      for (let c = 0; c < columnas; c++) {
        lugares.push({ x: izquierda + (c + 0.5) * w, y, w, h, fila: f, medio: false });
      }
    } else {
      lugares.push({ x: izquierda + w / 4, y, w: w / 2, h, fila: f, medio: true });
      for (let c = 0; c < columnas - 1; c++) {
        lugares.push({ x: izquierda + w / 2 + (c + 0.5) * w, y, w, h, fila: f, medio: false });
      }
      lugares.push({ x: izquierda + anchoMuro - w / 4, y, w: w / 2, h, fila: f, medio: true });
    }
  }

  // Repartir las respuestas en lugares enteros al azar (determinístico)
  const enteros = lugares.map((l, idx) => (l.medio ? -1 : idx)).filter((idx) => idx >= 0);
  for (let k = enteros.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [enteros[k], enteros[j]] = [enteros[j], enteros[k]];
  }
  const textoDe = new Map<number, string>();
  textos.forEach((t, k) => textoDe.set(enteros[k], t));

  // Orden de caída: de abajo hacia arriba, y dentro de cada fila en orden mezclado
  const porFila = new Map<number, number[]>();
  lugares.forEach((l, idx) => {
    const lista = porFila.get(l.fila) ?? [];
    lista.push(idx);
    porFila.set(l.fila, lista);
  });
  const orden: number[] = [];
  for (let f = 0; f < filas; f++) {
    const fila = porFila.get(f) ?? [];
    for (let k = fila.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [fila[k], fila[j]] = [fila[j], fila[k]];
    }
    orden.push(...fila);
  }

  const ladrillos: LadrilloLayout[] = orden.map((idx, i) => ({
    ...lugares[idx],
    i,
    texto: textoDe.get(idx) ?? null,
    semilla: Math.floor(rng() * 2 ** 31),
  }));

  return {
    ladrillos,
    piso,
    arriba: piso - filas * h,
    ancho: anchoMuro,
    izquierda,
    anchoLadrillo: w,
    altoLadrillo: h,
  };
}
