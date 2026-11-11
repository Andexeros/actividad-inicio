import { actividad } from "@/config/actividad";
import { esAdmin } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * GET /admin/exportar            → todas las respuestas (todas las sesiones, también reinicios)
 * GET /admin/exportar?iglesia=x  → solo esa iglesia
 *
 * CSV con ";" y BOM UTF-8: Excel en español (Argentina) lo abre bien con tildes.
 */

type Fila = {
  fase: number;
  pregunta: number;
  texto: string;
  visible: boolean;
  filtrada: boolean;
  created_at: string;
  iglesias: { slug: string; nombre: string } | null;
  sesiones: { created_at: string; activa: boolean } | null;
};

function celda(v: string | number | boolean): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export async function GET(request: Request) {
  if (!(await esAdmin())) return new Response("No autorizado", { status: 401 });

  const slug = new URL(request.url).searchParams.get("iglesia");
  const db = getServiceSupabase();

  let iglesiaId: string | null = null;
  if (slug) {
    const { data } = await db.from("iglesias").select("id").eq("slug", slug).maybeSingle<{ id: string }>();
    if (!data) return new Response("Iglesia no encontrada", { status: 404 });
    iglesiaId = data.id;
  }

  // De a 1000 (límite por consulta de Supabase)
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    let q = db
      .from("respuestas")
      .select("fase, pregunta, texto, visible, filtrada, created_at, iglesias(slug, nombre), sesiones(created_at, activa)")
      .order("created_at", { ascending: true })
      .range(desde, desde + 999);
    if (iglesiaId) q = q.eq("iglesia_id", iglesiaId);
    const { data, error } = await q.returns<Fila[]>();
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const encabezado = ["iglesia", "sesion_inicio", "sesion_activa", "fase", "pregunta", "texto_pregunta", "respuesta", "visible", "filtrada", "fecha"];
  const lineas = filas.map((f) => {
    const textoPregunta =
      f.fase === 1 ? (actividad.fase1.preguntas[f.pregunta] ?? "") : actividad.fase2.pregunta;
    return [
      f.iglesias?.nombre ?? "",
      f.sesiones ? fecha(f.sesiones.created_at) : "",
      f.sesiones?.activa ? "sí" : "no",
      f.fase,
      f.fase === 1 ? f.pregunta + 1 : "",
      textoPregunta,
      f.texto,
      f.visible ? "sí" : "no",
      f.filtrada ? "sí" : "no",
      fecha(f.created_at),
    ]
      .map(celda)
      .join(";");
  });

  const csv = "﻿" + [encabezado.join(";"), ...lineas].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="el-muro-respuestas${slug ? `-${slug}` : ""}-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
