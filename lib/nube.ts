/**
 * Nube de palabras: agrupa respuestas iguales y las acomoda en espiral sin superponerse.
 * Puro (recibe una función para medir texto), así se usa en TV y en admin.
 */

export type Conteo = { texto: string; n: number };

export function normalizarRespuesta(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Agrupa respuestas equivalentes ("Orgullo", "orgullo!") y muestra la forma más usada. */
export function contarRespuestas(textos: string[]): Conteo[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const t of textos) {
    const clave = normalizarRespuesta(t);
    if (!clave) continue;
    const formas = grupos.get(clave) ?? new Map<string, number>();
    const forma = t.trim();
    formas.set(forma, (formas.get(forma) ?? 0) + 1);
    grupos.set(clave, formas);
  }
  const conteos: Conteo[] = [];
  for (const formas of grupos.values()) {
    let mejor = "";
    let max = 0;
    let total = 0;
    for (const [forma, n] of formas) {
      total += n;
      if (n > max) {
        max = n;
        mejor = forma;
      }
    }
    conteos.push({ texto: mejor, n: total });
  }
  return conteos.sort((a, b) => b.n - a.n || a.texto.localeCompare(b.texto, "es"));
}

export type PalabraUbicada = Conteo & { x: number; y: number; tam: number; w: number; h: number; i: number };

export function ubicarNube(
  conteos: Conteo[],
  ancho: number,
  alto: number,
  medir: (texto: string, tam: number) => number,
  opciones: { tamMax?: number; tamMin?: number; max?: number } = {},
): PalabraUbicada[] {
  const lista = conteos.slice(0, opciones.max ?? 120);
  if (lista.length === 0) return [];
  const nMax = lista[0].n;
  const nMin = lista[lista.length - 1].n;
  const tamMax = opciones.tamMax ?? alto * 0.16;
  const tamMin = opciones.tamMin ?? Math.max(14, alto * 0.035);
  const ocupados: { x: number; y: number; w: number; h: number }[] = [];
  const res: PalabraUbicada[] = [];
  const pad = 6;

  const choca = (r: { x: number; y: number; w: number; h: number }) =>
    r.x - r.w / 2 < 0 ||
    r.x + r.w / 2 > ancho ||
    r.y - r.h / 2 < 0 ||
    r.y + r.h / 2 > alto ||
    ocupados.some(
      (o) => Math.abs(o.x - r.x) * 2 < o.w + r.w + pad && Math.abs(o.y - r.y) * 2 < o.h + r.h + pad,
    );

  lista.forEach((c, i) => {
    const rel = nMax === nMin ? (lista.length === 1 ? 1 : 0.5) : Math.sqrt((c.n - nMin) / (nMax - nMin));
    let tam = tamMin + (tamMax - tamMin) * rel;
    for (let intento = 0; intento < 4; intento++) {
      let w = medir(c.texto, tam);
      if (w > ancho * 0.9) {
        tam *= (ancho * 0.9) / w;
        w = medir(c.texto, tam);
      }
      const h = tam * 1.05;
      // Espiral de Arquímedes, achatada para pantallas anchas
      for (let paso = 0; paso < 1400; paso++) {
        const ang = paso * 0.35;
        const radio = 4 * Math.sqrt(paso) * Math.max(1, tam / 30);
        const r = { x: ancho / 2 + radio * Math.cos(ang) * 1.7, y: alto / 2 + radio * Math.sin(ang), w, h };
        if (!choca(r)) {
          ocupados.push(r);
          res.push({ ...c, ...r, tam, i });
          return;
        }
      }
      tam *= 0.8; // no entró: probar más chica
      if (tam < tamMin * 0.6) return;
    }
  });
  return res;
}
