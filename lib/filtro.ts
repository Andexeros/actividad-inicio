/**
 * Filtro simple de malas palabras en español (rioplatense).
 * Si una respuesta coincide se guarda con visible = false (el líder puede mostrarla igual).
 * Para sumar palabras, agregá un patrón: se compara contra cada palabra ya normalizada
 * (minúsculas, sin acentos, sin "leet": 0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s).
 */
const PATRONES: RegExp[] = [
  /^put[oa]s?$/,
  /^putit[oa]s?$/,
  /^pute(ar|ada|adas|o)$/,
  /^hdp$/,
  /^hijo?deput[oa]$/,
  /^mierd[ao]s?$/,
  /^carajo$/,
  /^conch(a|as|udo|uda|udos|udas)$/,
  /^conchetumadre$/,
  /^pij(a|as|ita|udo|uda)$/,
  /^verg(a|as|ota)$/,
  /^garch(a|as|ar|ada)$/,
  /^chot(o|a|os|as)$/,
  /^ort(o|ito)$/,
  /^culiad[oa]s?$/,
  /^cul(o|os)$/,
  /^forr(o|a|os|as)$/,
  /^pelotud[oa]s?$/,
  /^bolud[oa]s?$/,
  /^tarad[oa]s?$/,
  /^mogolic[oa]s?$/,
  /^trol(o|a|os|as)$/,
  /^marica?s?$/,
  /^maricon(es)?$/,
  /^puñeta$/,
  /^cag(ar|on|ada|ate)$/,
  /^cogi(da|endo)$/,
  /^cog(er|eme|e)$/,
  /^pajer[oa]s?$/,
  /^tet(a|as|ona)$/,
  /^ctm$/,
  /^lpm$/,
  /^lpqtp$/,
  /^ptm$/,
  /^nazi$/,
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

/** "puuuuto" → "puto" */
function colapsarRepetidas(palabra: string): string {
  return palabra.replace(/(.)\1+/g, "$1");
}

export function tieneMalasPalabras(texto: string): boolean {
  const normal = normalizar(texto);
  const palabras = normal.split(/[^a-zñ]+/).filter(Boolean);
  // También pegando todo, para "hijo de puta" → "hijodeputa"
  const candidatos = new Set<string>();
  for (const p of palabras) {
    candidatos.add(p);
    candidatos.add(colapsarRepetidas(p));
  }
  const pegado = palabras.join("");
  candidatos.add(pegado);
  candidatos.add(colapsarRepetidas(pegado));
  for (const c of candidatos) {
    if (PATRONES.some((re) => re.test(c))) return true;
  }
  return false;
}
