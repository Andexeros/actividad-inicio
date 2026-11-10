// Prueba contra tu Supabase real que:
//  - cada iglesia recibe por Realtime SOLO sus respuestas, en < 1 s
//  - las respuestas ocultas no llegan a la anon key
//  - la anon key no puede insertar respuestas ni cambiar fases
//
// Uso:  npm run probar:aislamiento
// Inserta unas respuestas de prueba en la sesión activa de cada iglesia y al final
//   las borra. Mejor no correrlo mientras la actividad está en curso.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Faltan variables en .env.local (ver .env.example)");
  process.exit(1);
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opciones);
const POR_IGLESIA = 5;
const LIMITE_MS = 1000;
let fallas = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const mal = (msg) => {
  fallas++;
  console.log(`  ✘ ${msg}`);
};

const { data: iglesias, error } = await admin.from("iglesias").select("id, slug").order("slug");
if (error) throw error;
const { data: sesiones, error: e2 } = await admin
  .from("sesiones")
  .select("id, iglesia_id, fase, pregunta_actual, entrada_abierta")
  .eq("activa", true);
if (e2) throw e2;
console.log(`Iglesias: ${iglesias.map((i) => i.slug).join(", ")}\n`);

const insertadas = [];
const anons = [];
try {
  // 1) Un cliente anon por iglesia (como si fueran 3 TVs), cada uno suscripto a su iglesia
  const recibidas = new Map(); // slug -> [{fila, t}]
  await Promise.all(
    iglesias.map(
      (ig) =>
        new Promise((resolve, reject) => {
          const anon = createClient(url, anonKey, opciones);
          anons.push(anon);
          recibidas.set(ig.slug, []);
          anon
            .channel(`prueba:${ig.slug}`)
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "respuestas", filter: `iglesia_id=eq.${ig.id}` },
              (p) => recibidas.get(ig.slug).push({ fila: p.new, t: Date.now() }),
            )
            .subscribe((estado) => {
              if (estado === "SUBSCRIBED") resolve();
              if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") reject(new Error(`${ig.slug}: ${estado}`));
            });
        }),
    ),
  );
  await new Promise((r) => setTimeout(r, 800));

  // 2) Insertar en paralelo en las 3 iglesias (+ una oculta por iglesia)
  const enviadoEn = new Map();
  await Promise.all(
    iglesias.map(async (ig) => {
      const sesion = sesiones.find((s) => s.iglesia_id === ig.id);
      for (let n = 1; n <= POR_IGLESIA + 1; n++) {
        const oculta = n > POR_IGLESIA;
        const t = Date.now();
        const { data, error } = await admin
          .from("respuestas")
          .insert({
            sesion_id: sesion.id,
            iglesia_id: ig.id,
            fase: 1,
            pregunta: 0,
            texto: oculta ? `oculta ${ig.slug}` : `prueba ${ig.slug} ${n}`,
            visible: !oculta,
          })
          .select("id")
          .single();
        if (error) throw error;
        insertadas.push(data.id);
        enviadoEn.set(data.id, t);
      }
    }),
  );
  await new Promise((r) => setTimeout(r, 2500));

  // 3) Verificar
  console.log("Realtime por iglesia:");
  for (const ig of iglesias) {
    const lista = recibidas.get(ig.slug);
    const ajenas = lista.filter((x) => x.fila.iglesia_id !== ig.id);
    const ocultas = lista.filter((x) => !x.fila.visible);
    const propias = lista.filter((x) => x.fila.iglesia_id === ig.id && x.fila.visible);
    const latencias = propias.map((x) => x.t - enviadoEn.get(x.fila.id));
    const peor = Math.max(0, ...latencias);
    if (propias.length === POR_IGLESIA) ok(`${ig.slug}: recibió sus ${POR_IGLESIA} respuestas`);
    else mal(`${ig.slug}: recibió ${propias.length}/${POR_IGLESIA}`);
    if (ajenas.length === 0) ok(`${ig.slug}: ninguna de otra iglesia`);
    else mal(`${ig.slug}: recibió ${ajenas.length} de otras iglesias`);
    if (ocultas.length === 0) ok(`${ig.slug}: no le llegaron ocultas`);
    else mal(`${ig.slug}: le llegaron ${ocultas.length} ocultas`);
    if (peor < LIMITE_MS) ok(`${ig.slug}: peor latencia ${peor} ms`);
    else mal(`${ig.slug}: peor latencia ${peor} ms (> ${LIMITE_MS})`);
  }

  // 4) Permisos de la anon key
  console.log("\nPermisos de la anon key:");
  const anon = anons[0];
  const s0 = sesiones[0];
  const ins = await anon.from("respuestas").insert({ sesion_id: s0.id, iglesia_id: s0.iglesia_id, fase: 1, texto: "hack" });
  const comprobar = (pasa, bien, malMsg) => (pasa ? ok(bien) : mal(malMsg));
  comprobar(Boolean(ins.error), "no puede insertar respuestas", "¡pudo insertar respuestas!");
  const upd = await anon.from("sesiones").update({ fase: "final" }).eq("id", s0.id).select();
  comprobar(Boolean(upd.error) || (upd.data?.length ?? 0) === 0, "no puede cambiar fases", "¡pudo cambiar la fase!");
  const pin = await anon.from("iglesias").select("host_pin");
  comprobar(Boolean(pin.error), "no puede leer host_pin", "¡pudo leer host_pin!");
  const ocultas = await anon.from("respuestas").select("id").eq("visible", false);
  comprobar(!ocultas.error && ocultas.data.length === 0, "no ve respuestas ocultas", "¡ve respuestas ocultas!");
} finally {
  if (insertadas.length) await admin.from("respuestas").delete().in("id", insertadas);
  for (const a of anons) await a.removeAllChannels();
  console.log(`\nLimpieza: ${insertadas.length} respuestas de prueba borradas.`);
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo OK ✅");
process.exit(fallas ? 1 : 0);
