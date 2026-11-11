// Chequeo antes de la actividad: variables, conexión, migraciones, iglesias y sesiones.
// Solo lee, no cambia nada.  Uso: npm run chequeo
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

let fallas = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const mal = (m) => {
  fallas++;
  console.log(`  ✘ ${m}`);
};
const aviso = (m) => console.log(`  ! ${m}`);
function si(cond, bien, malo, avisar = false) {
  if (cond) ok(bien);
  else if (avisar) aviso(malo);
  else mal(malo);
}
const env = (...nombres) => nombres.map((n) => process.env[n]).find(Boolean);

console.log("Variables de entorno:");
const url = env("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const publica = env("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const servicio = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
si(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL", "falta NEXT_PUBLIC_SUPABASE_URL (la necesita el navegador)");
si(publica, "clave pública para el navegador", "falta NEXT_PUBLIC_SUPABASE_ANON_KEY (o ..._PUBLISHABLE_KEY)");
si(servicio, "clave de servicio", "falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY)");
{
  const v = process.env.ADMIN_PIN;
  if (!v) mal("falta ADMIN_PIN (para entrar a /admin)");
  else if (!/^[0-9]{4,8}$/.test(v)) mal("ADMIN_PIN debe tener entre 4 y 8 números");
  else ok("ADMIN_PIN");
}
const secreto = process.env.SESSION_SECRET;
if (secreto && secreto.length < 16) mal("SESSION_SECRET es muy corto (16+ caracteres) o borralo para usar el automático");
else ok(secreto ? "SESSION_SECRET" : "secreto de sesión automático (derivado de Supabase)");
si(process.env.NEXT_PUBLIC_SITE_URL, `NEXT_PUBLIC_SITE_URL = ${process.env.NEXT_PUBLIC_SITE_URL} (dirección del QR)`, "NEXT_PUBLIC_SITE_URL vacía: el QR usa la dirección de la página (está bien)", true);

if (url && servicio && publica) {
  const o = { auth: { persistSession: false } };
  const db = createClient(url, servicio, o);
  const anon = createClient(url, publica, o);

  console.log("\nBase de datos:");
  const archivos = fs.readdirSync(path.join(process.cwd(), "supabase", "migrations")).filter((f) => f.endsWith(".sql"));
  const mig = await db.from("_migraciones").select("nombre");
  if (mig.error) {
    aviso("no hay registro de migraciones (¿se corrieron a mano en el SQL Editor?): reviso las tablas");
  } else {
    const hechas = new Set(mig.data.map((m) => m.nombre));
    const faltan = archivos.filter((a) => !hechas.has(a));
    si(!faltan.length, `${archivos.length} migraciones aplicadas`, `faltan migraciones: ${faltan.join(", ")} → npm run migrar`);
  }

  const ig = await db.from("iglesias").select("id, slug, nombre, host_pin").order("nombre");
  if (ig.error) mal(`no se pudo leer iglesias: ${ig.error.message}`);
  else {
    ok(`${ig.data.length} iglesias`);
    const ses = await db.from("sesiones").select("iglesia_id, fase, entrada_abierta").eq("activa", true);
    const cuenta = await db.from("respuestas").select("sesion_id, sesiones!inner(activa)", { count: "exact", head: true }).eq("sesiones.activa", true);
    for (const i of ig.data) {
      const s = ses.data?.find((x) => x.iglesia_id === i.id);
      if (!s) mal(`${i.nombre} (/${i.slug}): sin sesión activa`);
      else if (s.fase !== "lobby") aviso(`${i.nombre} (/${i.slug}): está en "${s.fase}", no en Inicio. Si es otra actividad, reiniciala desde su TV.`);
      else ok(`${i.nombre}: lista en Inicio · TV /${i.slug} · celular /${i.slug}/r`);
    }
    if (!cuenta.error && cuenta.count) aviso(`hay ${cuenta.count} respuestas en las sesiones actuales`);
  }

  console.log("\nSeguridad (clave pública):");
  const pin = await anon.from("iglesias").select("host_pin").limit(1);
  si(pin.error, "no puede leer los PIN", "¡puede leer los PIN! Revisá la migración 1");
  const upd = await anon.from("sesiones").update({ fase: "final" }).eq("fase", "nunca").select();
  si(upd.error || (upd.data?.length ?? 0) === 0, "no puede cambiar fases", "¡puede cambiar fases!");
}

console.log(fallas ? `\n${fallas} problema(s) para resolver.` : "\nTodo listo ✅");
process.exit(fallas ? 1 : 0);
