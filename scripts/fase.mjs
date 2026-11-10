// Cambia a mano la fase de una iglesia (útil para probar antes de que exista el panel host).
//
//   npm run fase -- isla fase1 0     → fase 1, pregunta 1, entrada abierta
//   npm run fase -- isla fase1 2     → fase 1, pregunta 3
//   npm run fase -- isla fase2       → fase 2, entrada abierta
//   npm run fase -- isla cerrar      → cierra la entrada (mantiene la fase)
//   npm run fase -- isla lobby       → vuelve a lobby

import { createClient } from "@supabase/supabase-js";

const [slug, accion, pregunta = "0"] = process.argv.slice(2);
if (!slug || !accion) {
  console.error("Uso: npm run fase -- <slug> <fase1|fase2|cerrar|lobby> [pregunta]");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: iglesia } = await db.from("iglesias").select("id, nombre").eq("slug", slug).maybeSingle();
if (!iglesia) {
  console.error(`No existe la iglesia "${slug}"`);
  process.exit(1);
}
const { data: sesion } = await db
  .from("sesiones")
  .select("id, version")
  .eq("iglesia_id", iglesia.id)
  .eq("activa", true)
  .single();

const cambios = {
  fase1: { fase: "fase1_respondiendo", pregunta_actual: Number(pregunta), entrada_abierta: true },
  fase2: { fase: "fase2", pregunta_actual: 0, entrada_abierta: true },
  cerrar: { entrada_abierta: false },
  lobby: { fase: "lobby", pregunta_actual: 0, entrada_abierta: false },
}[accion];
if (!cambios) {
  console.error(`Acción desconocida: ${accion}`);
  process.exit(1);
}

const { error } = await db
  .from("sesiones")
  .update({ ...cambios, version: sesion.version + 1 })
  .eq("id", sesion.id);
if (error) throw error;
console.log(`${iglesia.nombre}:`, cambios);
