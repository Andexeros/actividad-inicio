"use client";

import { useMemo, useState, useTransition } from "react";
import { actividad } from "@/config/actividad";
import { borrarRespuestas, borrarTodoYReiniciar, type DatosAdmin } from "@/lib/admin";
import { normalizarRespuesta } from "@/lib/nube";

const selectCls =
  "rounded-lg border border-foreground/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-ladrillo-400";

/**
 * Todas las respuestas de las sesiones activas, con filtros, búsqueda, exportación
 * y borrado (de a una, o todo con reinicio).
 */
export function ListaRespuestas({ datos, onCambio }: { datos: DatosAdmin; onCambio: () => void }) {
  const [iglesia, setIglesia] = useState("todas");
  const [fase, setFase] = useState("todas");
  const [pregunta, setPregunta] = useState("todas");
  const [visibilidad, setVisibilidad] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borradas, setBorradas] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function borrarUna(id: string) {
    setConfirmando(null);
    setBorradas((b) => new Set(b).add(id));
    startTransition(async () => {
      const r = await borrarRespuestas([id]);
      if (!r.ok) {
        setAviso(r.error);
        setBorradas((b) => {
          const n = new Set(b);
          n.delete(id);
          return n;
        });
      }
      onCambio();
    });
  }

  const nombres = useMemo(() => new Map(datos.iglesias.map((i) => [i.id, i.nombre])), [datos.iglesias]);
  const q = normalizarRespuesta(busqueda);

  const lista = datos.respuestas.filter((r) => {
    if (borradas.has(r.id)) return false;
    const visible = r.visible;
    if (iglesia !== "todas" && r.iglesia_id !== iglesia) return false;
    if (fase !== "todas" && String(r.fase) !== fase) return false;
    if (fase === "1" && pregunta !== "todas" && String(r.pregunta) !== pregunta) return false;
    if (visibilidad === "visibles" && !visible) return false;
    if (visibilidad === "ocultas" && visible) return false;
    if (q && !normalizarRespuesta(r.texto).includes(q)) return false;
    return true;
  });

  const slugElegido = datos.iglesias.find((i) => i.id === iglesia)?.slug;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar texto…"
          aria-label="Buscar"
          className={`${selectCls} min-w-48 flex-1`}
        />
        <select value={iglesia} onChange={(e) => setIglesia(e.target.value)} className={selectCls} aria-label="Iglesia">
          <option value="todas">Todas las iglesias</option>
          {datos.iglesias.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
        <select
          value={fase}
          onChange={(e) => {
            setFase(e.target.value);
            setPregunta("todas");
          }}
          className={selectCls}
          aria-label="Fase"
        >
          <option value="todas">Ambas fases</option>
          <option value="1">Fase 1</option>
          <option value="2">Fase 2</option>
        </select>
        {fase === "1" && (
          <select value={pregunta} onChange={(e) => setPregunta(e.target.value)} className={selectCls} aria-label="Pregunta">
            <option value="todas">Todas las preguntas</option>
            {actividad.fase1.preguntas.map((_, k) => (
              <option key={k} value={k}>
                Pregunta {k + 1}
              </option>
            ))}
          </select>
        )}
        <select value={visibilidad} onChange={(e) => setVisibilidad(e.target.value)} className={selectCls} aria-label="Visibilidad">
          <option value="todas">Visibles y ocultas</option>
          <option value="visibles">Solo visibles</option>
          <option value="ocultas">Solo ocultas</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-foreground/60">
          {lista.length} de {datos.respuestas.length} respuestas (sesiones actuales)
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Es una descarga (route handler), no una página: va <a>, no <Link> */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin/exportar" className="rounded-lg bg-ladrillo-500 px-3 py-1.5 font-semibold text-ladrillo-50 hover:bg-ladrillo-400">
            Exportar todo (CSV)
          </a>
          {slugElegido && (
            <a
              href={`/admin/exportar?iglesia=${encodeURIComponent(slugElegido)}`}
              className="rounded-lg border border-foreground/20 px-3 py-1.5 font-semibold hover:bg-foreground/10"
            >
              Exportar {nombres.get(iglesia)} (CSV)
            </a>
          )}
        </div>
      </div>
      <p className="-mt-2 text-xs text-foreground/40">
        El CSV incluye también las respuestas de actividades anteriores (reinicios), con fecha de cada sesión.
      </p>

      {aviso && <p className="rounded-lg bg-ladrillo-800/50 px-3 py-2 text-sm">{aviso}</p>}

      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-foreground/50">
          No hay respuestas con esos filtros.
        </p>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {lista.map((r) => {
            const visible = r.visible;
            return (
              <li key={r.id} className={`flex items-center gap-3 px-3 py-2 ${visible ? "" : "bg-ladrillo-800/20"}`}>
                <span className="w-20 shrink-0 truncate text-xs font-semibold text-ladrillo-200">
                  {nombres.get(r.iglesia_id) ?? "?"}
                </span>
                <span className="w-16 shrink-0 text-xs text-foreground/40">
                  {r.fase === 1 ? `F1 · P${r.pregunta + 1}` : "F2"}
                </span>
                <span className={`min-w-0 flex-1 truncate ${visible ? "" : "text-foreground/40 line-through"}`}>
                  {r.texto}
                  {!r.visible && (
                    <span className="ml-2 text-xs text-foreground/40 no-underline">({r.filtrada ? "filtro" : "oculta"})</span>
                  )}
                </span>
                <span className="hidden shrink-0 text-xs tabular-nums text-foreground/40 sm:block">
                  {new Date(r.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {confirmando === r.id ? (
                  <button
                    type="button"
                    onClick={() => borrarUna(r.id)}
                    className="shrink-0 rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    ¿Borrar? Sí
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(r.id)}
                    title="Borrar esta respuesta"
                    aria-label={`Borrar "${r.texto}"`}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-foreground/40 hover:bg-red-900/40 hover:text-red-200"
                  >
                    🗑
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <BorrarTodo datos={datos} onCambio={onCambio} />
    </div>
  );
}

/** Empezar de cero: borra todas las respuestas (de una iglesia o de todas) y deja la TV en Inicio. */
function BorrarTodo({ datos, onCambio }: { datos: DatosAdmin; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [alcance, setAlcance] = useState("todas");
  const [texto, setTexto] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();
  const nombre = alcance === "todas" ? "todas las iglesias" : datos.iglesias.find((i) => i.id === alcance)?.nombre;

  function borrar() {
    startTransition(async () => {
      const r = await borrarTodoYReiniciar(alcance === "todas" ? null : alcance);
      if (r.ok) {
        setMensaje({ ok: true, texto: `Listo: se borraron ${r.datos} respuestas y ${nombre} quedó en Inicio.` });
        setAbierto(false);
        setTexto("");
      } else setMensaje({ ok: false, texto: r.error });
      onCambio();
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-4">
      <h2 className="font-semibold text-red-200">Empezar de cero</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Borra para siempre todas las respuestas (también las de pruebas y actividades anteriores) y deja la TV en
        Inicio con el muro vacío. Si querés guardarlas, exportá el CSV antes.
      </p>
      {!abierto ? (
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
            setMensaje(null);
          }}
          className="mt-3 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/40"
        >
          Borrar todo y reiniciar…
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={alcance} onChange={(e) => setAlcance(e.target.value)} className={selectCls} aria-label="Qué iglesia">
            <option value="todas">Todas las iglesias</option>
            {datos.iglesias.map((i) => (
              <option key={i.id} value={i.id}>
                Solo {i.nombre}
              </option>
            ))}
          </select>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí BORRAR"
            aria-label="Escribí BORRAR para confirmar"
            className={`${selectCls} w-40`}
          />
          <button
            type="button"
            onClick={borrar}
            disabled={texto.trim().toUpperCase() !== "BORRAR" || pendiente}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {pendiente ? "Borrando…" : `Borrar ${nombre}`}
          </button>
          <button type="button" onClick={() => setAbierto(false)} className="rounded-lg px-3 py-2 text-sm text-foreground/60">
            Cancelar
          </button>
        </div>
      )}
      {mensaje && (
        <p className={`mt-3 text-sm ${mensaje.ok ? "text-emerald-300" : "text-red-200"}`}>{mensaje.texto}</p>
      )}
    </section>
  );
}
