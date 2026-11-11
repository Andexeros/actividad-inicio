"use client";

import { useState, useTransition } from "react";
import { crearIglesia, editarIglesia, type DatosAdmin, type IglesiaAdmin } from "@/lib/admin";

const inputCls =
  "w-full rounded-lg border border-foreground/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-ladrillo-400";

/** Crear y editar iglesias (slug, nombre y PIN propio del líder). */
export function GestionIglesias({ datos, onCambio }: { datos: DatosAdmin; onCambio: () => void }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-foreground/60">
        El <b>slug</b> es la dirección corta: <code>/slug</code> para el celular (es la del QR), <code>/slug/tv</code> y{" "}
        <code>/slug/host</code>. Si una iglesia no tiene PIN propio, sus líderes usan el PIN general (<code>HOST_PIN</code>).
      </p>
      {datos.iglesias.map((ig) => (
        <FormIglesia key={ig.id} iglesia={ig} onGuardado={onCambio} />
      ))}
      <FormIglesia onGuardado={onCambio} />
    </div>
  );
}

function FormIglesia({ iglesia, onGuardado }: { iglesia?: IglesiaAdmin; onGuardado: () => void }) {
  const nueva = !iglesia;
  const [slug, setSlug] = useState(iglesia?.slug ?? "");
  const [nombre, setNombre] = useState(iglesia?.nombre ?? "");
  const [pin, setPin] = useState(iglesia?.host_pin ?? "");
  const [mostrarPin, setMostrarPin] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const cambioSlug = iglesia && slug.trim().toLowerCase() !== iglesia.slug;
  const sinCambios =
    iglesia && !cambioSlug && nombre.trim() === iglesia.nombre && (pin.trim() || null) === iglesia.host_pin;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    startTransition(async () => {
      const d = { slug, nombre, pin };
      const r = iglesia ? await editarIglesia(iglesia.id, d) : await crearIglesia(d);
      if (r.ok) {
        setMensaje({ ok: true, texto: nueva ? `Creada: /${r.datos.slug}` : "Guardado." });
        if (nueva) {
          setSlug("");
          setNombre("");
          setPin("");
        }
        onGuardado();
      } else setMensaje({ ok: false, texto: r.error });
    });
  }

  return (
    <form
      onSubmit={guardar}
      className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end ${
        nueva ? "border-dashed border-foreground/20" : "border-foreground/10 bg-black/20"
      }`}
    >
      {nueva && <h2 className="font-semibold sm:col-span-4">Nueva iglesia</h2>}
      <label className="flex flex-col gap-1 text-xs text-foreground/60">
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} required className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-foreground/60">
        Slug (dirección)
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          maxLength={30}
          required
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-foreground/60">
        PIN propio (opcional)
        <div className="flex gap-1">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            type={mostrarPin ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            placeholder="General"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setMostrarPin((v) => !v)}
            className="shrink-0 rounded-lg border border-foreground/15 px-2 text-xs"
            aria-label={mostrarPin ? "Ocultar PIN" : "Mostrar PIN"}
          >
            {mostrarPin ? "🙈" : "👁"}
          </button>
        </div>
      </label>
      <button
        type="submit"
        disabled={pendiente || Boolean(sinCambios)}
        className="h-[38px] rounded-lg bg-ladrillo-500 px-4 text-sm font-semibold text-ladrillo-50 hover:bg-ladrillo-400 disabled:opacity-40"
      >
        {pendiente ? "…" : nueva ? "Crear" : "Guardar"}
      </button>
      {cambioSlug && (
        <p className="text-xs text-luz sm:col-span-4">
          Ojo: al cambiar el slug cambia la dirección (y el QR) de esta iglesia. Los links viejos dejan de andar.
        </p>
      )}
      {mensaje && (
        <p className={`text-sm sm:col-span-4 ${mensaje.ok ? "text-emerald-300" : "text-ladrillo-200"}`}>{mensaje.texto}</p>
      )}
    </form>
  );
}
