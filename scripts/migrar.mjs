// Corre las migraciones de supabase/migrations que todavía no se aplicaron, en orden.
// Guarda cuáles corrió en la tabla public._migraciones, así se puede ejecutar de nuevo sin riesgo.
//
// Uso: npm run migrar   (usa POSTGRES_URL_NON_POOLING de .env.local)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING en .env.local");
  process.exit(1);
}

// Conexión cifrada y verificada. Si el certificado de Supabase no es de una CA pública,
// descargá el de Supabase (Dashboard → Database → Settings → SSL → Download certificate)
// y poné su ruta en SUPABASE_CA_CERT.
const conexion = url.replace(/[?&]sslmode=[^&]*/g, "").replace(/[?&]supa=[^&]*/g, "");
const ca = process.env.SUPABASE_CA_CERT ? fs.readFileSync(process.env.SUPABASE_CA_CERT, "utf8") : undefined;
const cliente = new pg.Client({ connectionString: conexion, ssl: ca ? { ca } : true });

const dir = path.join(process.cwd(), "supabase", "migrations");
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

await cliente.connect();
try {
  await cliente.query(`create table if not exists public._migraciones (
    nombre text primary key,
    aplicada_en timestamptz not null default now()
  )`);
  await cliente.query("alter table public._migraciones enable row level security");
  await cliente.query("revoke all on public._migraciones from anon, authenticated");

  const { rows } = await cliente.query("select nombre from public._migraciones");
  const hechas = new Set(rows.map((r) => r.nombre));
  let nuevas = 0;
  for (const archivo of archivos) {
    if (hechas.has(archivo)) {
      console.log(`· ${archivo} (ya aplicada)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, archivo), "utf8");
    await cliente.query("begin");
    try {
      await cliente.query(sql);
      await cliente.query("insert into public._migraciones (nombre) values ($1)", [archivo]);
      await cliente.query("commit");
      console.log(`✔ ${archivo}`);
      nuevas++;
    } catch (e) {
      await cliente.query("rollback");
      console.error(`✘ ${archivo}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  console.log(nuevas ? `\n${nuevas} migración(es) aplicada(s).` : "\nNada nuevo para aplicar.");
} finally {
  await cliente.end();
}
