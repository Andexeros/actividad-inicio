"use client";

import Matter from "matter-js";
import type { LadrilloLayout, MuroLayout } from "./layout";
import type { Sprite } from "./sprites";

/**
 * Motor del muro: física con Matter.js y dibujo propio en canvas.
 *
 * Estados de un ladrillo:
 *  - esperando: todavía no apareció (construcción animada)
 *  - cayendo:   cuerpo dinámico cayendo hacia su lugar
 *  - asentando: tocó y se acomoda en su lugar (interpolación corta)
 *  - puesto:    estático en el muro
 *  - suelto:    dinámico con física libre (fase 2 / derrumbe)
 */
type Estado = "esperando" | "cayendo" | "asentando" | "puesto" | "suelto";

type Ladrillo = {
  layout: LadrilloLayout;
  sprite: Sprite;
  body: Matter.Body;
  estado: Estado;
  /** Inercia real (mientras cae se usa infinita para que no rote). */
  inercia: number;
  asentarDesde?: { x: number; y: number; a: number; t: number };
};

const MS_ASENTAR = 110;
const PASO_MS = 1000 / 60;

export type EventosMotor = {
  /** Un ladrillo apoyó durante la construcción (para el sonido). */
  onApoyo?: (l: LadrilloLayout) => void;
  /** Terminó la construcción animada. */
  onFinConstruccion?: () => void;
};

export class MotorMuro {
  private engine = Matter.Engine.create({ gravity: { x: 0, y: 1.6 } });
  private ctx: CanvasRenderingContext2D;
  private ladrillos: Ladrillo[] = [];
  private porBody = new Map<number, Ladrillo>();
  private raf = 0;
  private ultimoT = 0;
  private tiempoSim = 0;
  private construccion: { msEntre: number; inicio: number; siguiente: number } | null = null;
  private destruido = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private layout: MuroLayout,
    sprites: Sprite[],
    private ancho: number,
    private alto: number,
    private dpr: number,
    private eventos: EventosMotor = {},
  ) {
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;

    // Piso y paredes invisibles (las paredes, lejos, para que lo suelto no se vaya al infinito)
    const piso = Matter.Bodies.rectangle(ancho / 2, layout.piso + 50, ancho * 4, 100, { isStatic: true, friction: 0.9 });
    const izq = Matter.Bodies.rectangle(-ancho * 0.6, alto / 2, 100, alto * 4, { isStatic: true });
    const der = Matter.Bodies.rectangle(ancho * 1.6, alto / 2, 100, alto * 4, { isStatic: true });
    Matter.Composite.add(this.engine.world, [piso, izq, der]);

    layout.ladrillos.forEach((l, k) => {
      // Se crean dinámicos (no `isStatic`): Matter solo guarda masa/inercia originales
      // cuando un cuerpo dinámico pasa a estático, y las necesitamos para soltarlos después.
      const body = Matter.Bodies.rectangle(l.x, l.y, l.w - 0.6, l.h - 0.6, {
        friction: 0.7,
        frictionStatic: 1,
        restitution: 0.04,
        density: 0.002,
        slop: 0.02,
      });
      const ladrillo: Ladrillo = {
        layout: l,
        sprite: sprites[k],
        body,
        estado: "esperando",
        inercia: body.inertia,
      };
      this.ladrillos.push(ladrillo);
      this.porBody.set(body.id, ladrillo);
    });

    Matter.Events.on(this.engine, "collisionStart", (ev) => {
      for (const par of ev.pairs) {
        this.alChocar(par.bodyA, par.bodyB);
        this.alChocar(par.bodyB, par.bodyA);
      }
    });
  }

  /** Muro completo, quieto (recarga / entre fases). */
  colocarTodos() {
    for (const l of this.ladrillos) {
      if (!this.engine.world.bodies.includes(l.body)) Matter.Composite.add(this.engine.world, l.body);
      if (!l.body.isStatic) Matter.Body.setStatic(l.body, true);
      Matter.Body.setPosition(l.body, { x: l.layout.x, y: l.layout.y });
      Matter.Body.setAngle(l.body, 0);
      l.estado = "puesto";
    }
    this.construccion = null;
    this.dibujar();
  }

  /** Construcción animada: un ladrillo cada `msEntre` ms, de abajo hacia arriba. */
  construir(msEntre: number) {
    this.construccion = { msEntre, inicio: this.tiempoSim, siguiente: 0 };
    this.despertar();
  }

  /** Completa al instante lo que falte (p. ej. si cambia el tamaño de pantalla). */
  terminarYa() {
    const habia = this.construccion !== null;
    this.colocarTodos();
    if (habia) this.eventos.onFinConstruccion?.();
  }

  get construyendo() {
    return this.construccion !== null;
  }

  destruir() {
    this.destruido = true;
    cancelAnimationFrame(this.raf);
    Matter.Events.off(this.engine, "collisionStart", undefined as never);
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
  }

  // ───────────────────────── internos ─────────────────────────

  private alChocar(a: Matter.Body, b: Matter.Body) {
    const l = this.porBody.get(a.id);
    if (!l || l.estado !== "cayendo") return;
    const otro = this.porBody.get(b.id);
    // Apoya sobre el piso o sobre un ladrillo ya puesto
    if (b.isStatic && (!otro || otro.estado === "puesto" || otro.estado === "asentando")) {
      this.apoyar(l);
    }
  }

  private apoyar(l: Ladrillo) {
    Matter.Body.setStatic(l.body, true);
    l.estado = "asentando";
    l.asentarDesde = { x: l.body.position.x, y: l.body.position.y, a: l.body.angle, t: this.tiempoSim };
    this.eventos.onApoyo?.(l.layout);
  }

  private despertar() {
    if (this.raf || this.destruido) return;
    this.ultimoT = performance.now();
    this.raf = requestAnimationFrame(this.cuadro);
  }

  private cuadro = (t: number) => {
    this.raf = 0;
    if (this.destruido) return;
    // dt acotado: si la pestaña estuvo oculta no "salta" todo de golpe
    const dt = Math.min(33, Math.max(1, t - this.ultimoT));
    this.ultimoT = t;
    this.tiempoSim += dt;

    this.avanzarConstruccion();
    // Matter quiere pasos de ≤ 16,7 ms: si el cuadro fue más largo, lo partimos
    const pasos = Math.ceil(dt / PASO_MS);
    for (let k = 0; k < pasos; k++) Matter.Engine.update(this.engine, dt / pasos);
    this.avanzarAsentados();
    this.dibujar();

    if (this.hayMovimiento()) this.raf = requestAnimationFrame(this.cuadro);
  };

  private avanzarConstruccion() {
    const c = this.construccion;
    if (!c) return;
    const transcurrido = this.tiempoSim - c.inicio;
    while (c.siguiente < this.ladrillos.length && c.siguiente * c.msEntre <= transcurrido) {
      const l = this.ladrillos[c.siguiente++];
      const { x, h } = l.layout;
      Matter.Body.setPosition(l.body, { x, y: -h * 1.5 });
      Matter.Body.setAngle(l.body, 0);
      Matter.Body.setVelocity(l.body, { x: 0, y: 16 });
      Matter.Body.setAngularVelocity(l.body, 0);
      // que no rote mientras cae (cae derecho a su lugar)
      Matter.Body.setInertia(l.body, Infinity);
      if (!this.engine.world.bodies.includes(l.body)) Matter.Composite.add(this.engine.world, l.body);
      l.estado = "cayendo";
    }
    // Seguridad: si algún ladrillo pasó su lugar sin chocar, lo apoyamos igual
    for (const l of this.ladrillos) {
      if (l.estado === "cayendo" && l.body.position.y >= l.layout.y) this.apoyar(l);
    }
    const terminados = this.ladrillos.every((l) => l.estado === "puesto");
    if (c.siguiente >= this.ladrillos.length && terminados) {
      this.construccion = null;
      this.eventos.onFinConstruccion?.();
    }
  }

  private avanzarAsentados() {
    for (const l of this.ladrillos) {
      if (l.estado !== "asentando" || !l.asentarDesde) continue;
      const p = Math.min(1, (this.tiempoSim - l.asentarDesde.t) / MS_ASENTAR);
      const e = 1 - Math.pow(1 - p, 3);
      const d = l.asentarDesde;
      Matter.Body.setPosition(l.body, {
        x: d.x + (l.layout.x - d.x) * e,
        y: d.y + (l.layout.y - d.y) * e,
      });
      Matter.Body.setAngle(l.body, d.a * (1 - e));
      if (p >= 1) {
        l.estado = "puesto";
        l.asentarDesde = undefined;
      }
    }
  }

  private hayMovimiento() {
    if (this.construccion) return true;
    return this.ladrillos.some(
      (l) => l.estado === "cayendo" || l.estado === "asentando" || (l.estado === "suelto" && !l.body.isSleeping),
    );
  }

  private dibujar() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.ancho, this.alto);
    for (const l of this.ladrillos) {
      if (l.estado === "esperando") continue;
      const { x, y } = l.body.position;
      const s = l.sprite;
      ctx.save();
      ctx.translate(x, y);
      if (l.body.angle) ctx.rotate(l.body.angle);
      ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }
  }
}
