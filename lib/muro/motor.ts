"use client";

import Matter from "matter-js";
import { crearPlanGolpes } from "./golpes";
import { crearRng, type LadrilloLayout, type MuroLayout } from "./layout";
import type { Sprite } from "./sprites";

/**
 * Motor del muro: física con Matter.js y dibujo propio en canvas.
 *
 * Estados de un ladrillo:
 *  - esperando: todavía no apareció (construcción animada)
 *  - cayendo:   cuerpo dinámico cayendo hacia su lugar
 *  - asentando: tocó y se acomoda en su lugar (interpolación corta)
 *  - puesto:    estático en el muro
 *  - suelto:    escombro con física libre (golpe de fase 2 o derrumbe). Cae "delante"
 *               del muro: choca con el piso y con otros escombros, no con el muro.
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

type Proyectil = {
  sprite: Sprite;
  desde: { x: number; y: number };
  control: { x: number; y: number };
  hasta: { x: number; y: number };
  t0: number;
  objetivos: Ladrillo[];
  /** Después del impacto: cuerpo físico que rebota y se desvanece. */
  body?: Matter.Body;
  tImpacto?: number;
  estela: { x: number; y: number }[];
  semilla: number;
};

type Destello = { x: number; y: number; t0: number; r: number };

const MS_ASENTAR = 110;
const MS_VUELO = 680;
const MS_DESVANECER = 1600;
const PASO_MS = 1000 / 60;

// Categorías de colisión
const CAT_PISO = 0x0001;
const CAT_MURO = 0x0002;
const CAT_ESCOMBRO = 0x0004;
const CAT_PROYECTIL = 0x0008;

export type EventosMotor = {
  /** Un ladrillo apoyó durante la construcción (para el sonido). */
  onApoyo?: (l: LadrilloLayout) => void;
  /** Terminó la construcción animada. */
  onFinConstruccion?: () => void;
  /** Un proyectil pegó en el muro. */
  onImpacto?: () => void;
};

export type CrearSpriteProyectil = (texto: string) => Sprite;

export class MotorMuro {
  private engine = Matter.Engine.create({ gravity: { x: 0, y: 1.6 }, enableSleeping: true });
  private ctx: CanvasRenderingContext2D;
  private ladrillos: Ladrillo[] = [];
  private porBody = new Map<number, Ladrillo>();
  private raf = 0;
  private ultimoT = 0;
  private tiempoSim = 0;
  private construccion: { msEntre: number; inicio: number; siguiente: number } | null = null;
  private destruido = false;
  private plan: ReturnType<typeof crearPlanGolpes>;
  private golpesAplicados = 0;
  private proyectiles: Proyectil[] = [];
  private colaGolpes: string[] = [];
  private proximoLanzamiento = 0;
  private destellos: Destello[] = [];
  private sacudida: { t0: number; dur: number; fuerza: number } | null = null;
  private derrumbado = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private layout: MuroLayout,
    sprites: Sprite[],
    private ancho: number,
    private alto: number,
    private dpr: number,
    private eventos: EventosMotor = {},
    private semilla = 1,
    private crearSpriteProyectil?: CrearSpriteProyectil,
  ) {
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.plan = crearPlanGolpes(layout, semilla);

    const filtroPiso = { category: CAT_PISO, mask: 0xffff };
    const piso = Matter.Bodies.rectangle(ancho / 2, layout.piso + 50, ancho * 4, 100, {
      isStatic: true,
      friction: 0.9,
      collisionFilter: filtroPiso,
    });
    const izq = Matter.Bodies.rectangle(-ancho * 0.6, alto / 2, 100, alto * 4, { isStatic: true, collisionFilter: filtroPiso });
    const der = Matter.Bodies.rectangle(ancho * 1.6, alto / 2, 100, alto * 4, { isStatic: true, collisionFilter: filtroPiso });
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
        collisionFilter: { category: CAT_MURO, mask: CAT_PISO | CAT_MURO },
      });
      const ladrillo: Ladrillo = { layout: l, sprite: sprites[k], body, estado: "esperando", inercia: body.inertia };
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

  // ───────────────────────── construcción (fase 1) ─────────────────────────

  /** Muro completo, quieto (recarga / entre fases). */
  colocarTodos() {
    for (const l of this.ladrillos) {
      if (l.estado === "suelto") continue;
      this.agregar(l.body);
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

  get construyendo() {
    return this.construccion !== null;
  }

  // ───────────────────────── golpes (fase 2) ─────────────────────────

  /** Golpes recibidos: ya lanzados (en vuelo o impactados) + los que esperan en la cola. */
  get cantidadGolpes() {
    return this.golpesAplicados + this.colaGolpes.length;
  }

  /**
   * Aplica N golpes sin animación (al recargar): los ladrillos de esos golpes ya están
   * caídos en el piso. Se simula la caída "en silencio" para que queden apoyados.
   */
  aplicarGolpesQuietos(cantidad: number) {
    let hubo = false;
    while (this.golpesAplicados < cantidad) {
      const objetivos = this.plan.siguiente().map((k) => this.ladrillos[k]);
      const n = this.golpesAplicados++;
      if (objetivos.length === 0) continue;
      const rng = crearRng(this.semilla + n * 7919);
      const lado = n % 2 === 0 ? 1 : -1;
      for (const l of objetivos) this.soltar(l, this.velocidadGolpe(l, lado, rng));
      hubo = true;
    }
    if (hubo) {
      this.presimular(240);
      this.despertar(); // si algo sigue moviéndose, termina de acomodarse a la vista
    }
    this.dibujar();
  }

  /** Encola un golpe animado (un proyectil con la palabra). Se lanzan espaciados. */
  golpear(texto: string) {
    if (this.derrumbado) {
      this.golpesAplicados++;
      return;
    }
    this.colaGolpes.push(texto);
    this.despertar();
  }

  /** El muro entero se viene abajo. `animado` = explosión con sacudida; si no, ya está caído. */
  derrumbar(animado: boolean) {
    if (this.derrumbado) return;
    this.derrumbado = true;
    this.construccion = null;
    const cx = this.layout.izquierda + this.layout.ancho / 2;
    const rng = crearRng(this.semilla ^ 0xdead);
    const alturaMuro = Math.max(1, this.layout.piso - this.layout.arriba);
    for (const l of this.ladrillos) {
      if (l.estado === "suelto") continue;
      if (l.estado === "esperando" || l.estado === "cayendo" || l.estado === "asentando") {
        Matter.Body.setPosition(l.body, { x: l.layout.x, y: l.layout.y });
        Matter.Body.setAngle(l.body, 0);
      }
      this.agregar(l.body);
      const altura = (this.layout.piso - l.layout.y) / alturaMuro; // 0 abajo, 1 arriba
      const dx = (l.layout.x - cx) / (this.layout.ancho / 2);
      this.soltar(l, {
        x: dx * (5 + rng() * 9) + (rng() - 0.5) * 4,
        y: -(3 + altura * 9 + rng() * 6),
        giro: (rng() - 0.5) * 0.5,
      });
    }
    if (animado) {
      this.sacudir(26, 1300);
      this.destellos.push({ x: cx, y: this.layout.piso - alturaMuro / 2, t0: this.tiempoSim, r: this.layout.ancho * 0.7 });
      this.despertar();
    } else {
      this.presimular(300);
      this.dibujar();
      this.despertar();
    }
  }

  get estaDerrumbado() {
    return this.derrumbado;
  }

  destruir() {
    this.destruido = true;
    cancelAnimationFrame(this.raf);
    Matter.Events.off(this.engine, "collisionStart", undefined as never);
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
  }

  // ───────────────────────── internos ─────────────────────────

  private agregar(body: Matter.Body) {
    if (!this.engine.world.bodies.includes(body)) Matter.Composite.add(this.engine.world, body);
  }

  private velocidadGolpe(l: Ladrillo, lado: number, rng: () => number) {
    return {
      x: lado * (2 + rng() * 4) + (rng() - 0.5) * 3,
      y: -(3 + rng() * 5),
      giro: (rng() - 0.5) * 0.35,
    };
  }

  /** Convierte un ladrillo del muro en escombro con física. */
  private soltar(l: Ladrillo, v: { x: number; y: number; giro: number }) {
    this.agregar(l.body);
    if (l.body.isStatic) Matter.Body.setStatic(l.body, false);
    Matter.Body.setInertia(l.body, l.inercia);
    l.body.collisionFilter = { category: CAT_ESCOMBRO, mask: CAT_PISO | CAT_ESCOMBRO | CAT_PROYECTIL, group: 0 };
    Matter.Sleeping.set(l.body, false);
    Matter.Body.setVelocity(l.body, { x: v.x, y: v.y });
    Matter.Body.setAngularVelocity(l.body, v.giro);
    l.estado = "suelto";
    l.asentarDesde = undefined;
  }

  private presimular(pasos: number) {
    for (let k = 0; k < pasos; k++) Matter.Engine.update(this.engine, PASO_MS);
  }

  private sacudir(fuerza: number, dur: number) {
    const actual = this.sacudida ? this.sacudida.fuerza * (1 - (this.tiempoSim - this.sacudida.t0) / this.sacudida.dur) : 0;
    if (fuerza >= actual) this.sacudida = { t0: this.tiempoSim, dur, fuerza };
  }

  private alChocar(a: Matter.Body, b: Matter.Body) {
    const l = this.porBody.get(a.id);
    if (!l || l.estado !== "cayendo") return;
    const otro = this.porBody.get(b.id);
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
    const dt = Math.min(33, Math.max(1, t - this.ultimoT));
    this.ultimoT = t;
    this.tiempoSim += dt;

    this.avanzarConstruccion();
    this.lanzarGolpes();
    this.avanzarProyectiles();
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
      Matter.Body.setInertia(l.body, Infinity); // cae derecho, sin rotar
      this.agregar(l.body);
      l.estado = "cayendo";
    }
    for (const l of this.ladrillos) {
      if (l.estado === "cayendo" && l.body.position.y >= l.layout.y) this.apoyar(l);
    }
    if (c.siguiente >= this.ladrillos.length && this.ladrillos.every((l) => l.estado === "puesto")) {
      this.construccion = null;
      this.eventos.onFinConstruccion?.();
    }
  }

  private lanzarGolpes() {
    if (!this.colaGolpes.length || this.tiempoSim < this.proximoLanzamiento) return;
    // Si se acumulan muchos, se lanzan más seguido
    const espera = this.colaGolpes.length > 4 ? 220 : 480;
    this.proximoLanzamiento = this.tiempoSim + espera;
    const texto = this.colaGolpes.shift()!;
    const n = this.golpesAplicados++;
    const objetivos = this.plan.siguiente().map((k) => this.ladrillos[k]);
    const lado = n % 2 === 0 ? 1 : -1;
    const sprite = this.crearSpriteProyectil?.(texto);
    if (!sprite) {
      const rng = crearRng(this.semilla + n * 7919);
      for (const l of objetivos) this.soltar(l, this.velocidadGolpe(l, lado, rng));
      return;
    }
    const blanco = objetivos[0]?.layout ?? {
      x: this.layout.izquierda + this.layout.ancho / 2,
      y: this.layout.piso - this.layout.altoLadrillo,
    };
    const desde = { x: this.ancho / 2 - lado * this.ancho * 0.32, y: this.alto + 160 };
    const hasta = { x: blanco.x, y: blanco.y };
    this.proyectiles.push({
      sprite,
      desde,
      control: { x: (desde.x + hasta.x) / 2, y: Math.min(desde.y, hasta.y) - this.alto * 0.28 },
      hasta,
      t0: this.tiempoSim,
      objetivos,
      estela: [],
      semilla: this.semilla + n * 7919,
    });
  }

  private posicionVuelo(p: Proyectil, e: number) {
    const u = 1 - e;
    return {
      x: u * u * p.desde.x + 2 * u * e * p.control.x + e * e * p.hasta.x,
      y: u * u * p.desde.y + 2 * u * e * p.control.y + e * e * p.hasta.y,
    };
  }

  private avanzarProyectiles() {
    for (const p of this.proyectiles) {
      if (p.body) continue;
      const e = Math.min(1, (this.tiempoSim - p.t0) / MS_VUELO);
      const pos = this.posicionVuelo(p, e);
      p.estela.unshift(pos);
      if (p.estela.length > 7) p.estela.pop();
      if (e >= 1) this.impactar(p);
    }
    // Quitar los que ya se desvanecieron
    this.proyectiles = this.proyectiles.filter((p) => {
      const fuera = p.tImpacto !== undefined && this.tiempoSim - p.tImpacto > MS_DESVANECER;
      if (fuera && p.body) Matter.Composite.remove(this.engine.world, p.body);
      return !fuera;
    });
    this.destellos = this.destellos.filter((d) => this.tiempoSim - d.t0 < 600);
  }

  private impactar(p: Proyectil) {
    const rng = crearRng(p.semilla);
    const lado = p.hasta.x >= p.desde.x ? 1 : -1;
    for (const l of p.objetivos) {
      this.soltar(l, {
        x: lado * (2 + rng() * 4) + (l.layout.x - p.hasta.x) * 0.04,
        y: -(4 + rng() * 5),
        giro: (rng() - 0.5) * 0.4,
      });
    }
    // El proyectil rebota hacia adelante y cae
    // El sprite incluye el halo de luz: el cuerpo físico es solo la "píldora" del centro
    const bw = p.sprite.w * 0.8;
    const bh = p.sprite.h * 0.55;
    const body = Matter.Bodies.rectangle(p.hasta.x, p.hasta.y, bw, bh, {
      chamfer: { radius: bh / 2 - 1 },
      restitution: 0.35,
      friction: 0.4,
      density: 0.0015,
      collisionFilter: { category: CAT_PROYECTIL, mask: CAT_PISO | CAT_ESCOMBRO },
    });
    Matter.Body.setVelocity(body, { x: -lado * (1.5 + rng() * 2), y: -5 - rng() * 3 });
    Matter.Body.setAngularVelocity(body, (rng() - 0.5) * 0.3);
    Matter.Composite.add(this.engine.world, body);
    p.body = body;
    p.tImpacto = this.tiempoSim;
    this.destellos.push({ x: p.hasta.x, y: p.hasta.y, t0: this.tiempoSim, r: this.layout.anchoLadrillo * 1.6 });
    this.sacudir(9, 380);
    this.eventos.onImpacto?.();
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
    if (this.construccion || this.colaGolpes.length || this.proyectiles.length || this.destellos.length) return true;
    if (this.sacudida && this.tiempoSim - this.sacudida.t0 < this.sacudida.dur) return true;
    return this.ladrillos.some(
      (l) => l.estado === "cayendo" || l.estado === "asentando" || (l.estado === "suelto" && !l.body.isSleeping),
    );
  }

  private dibujar() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.ancho, this.alto);

    // Sacudida de cámara
    if (this.sacudida) {
      const p = (this.tiempoSim - this.sacudida.t0) / this.sacudida.dur;
      if (p < 1) {
        const f = this.sacudida.fuerza * (1 - p) * (1 - p);
        ctx.translate((Math.random() - 0.5) * 2 * f, (Math.random() - 0.5) * 2 * f);
      } else this.sacudida = null;
    }

    // Muro (y lo que todavía cae), después los escombros por delante
    for (const l of this.ladrillos) if (l.estado !== "esperando" && l.estado !== "suelto") this.dibujarLadrillo(l);
    for (const l of this.ladrillos) if (l.estado === "suelto") this.dibujarLadrillo(l);

    // Destellos de impacto
    for (const d of this.destellos) {
      const p = (this.tiempoSim - d.t0) / 600;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * (0.6 + p));
      g.addColorStop(0, `rgb(255 220 150 / ${0.55 * (1 - p)})`);
      g.addColorStop(1, "rgb(255 160 80 / 0)");
      ctx.fillStyle = g;
      ctx.fillRect(d.x - d.r * 2, d.y - d.r * 2, d.r * 4, d.r * 4);
    }

    // Proyectiles
    for (const p of this.proyectiles) {
      const s = p.sprite;
      if (!p.body) {
        const e = Math.min(1, (this.tiempoSim - p.t0) / MS_VUELO);
        const escala = 2.4 - 1.4 * e; // viene "desde el público" hacia el muro
        p.estela.forEach((pt, k) => {
          if (k === 0) return;
          ctx.globalAlpha = 0.18 * (1 - k / p.estela.length);
          ctx.drawImage(s.canvas, pt.x - (s.w * escala) / 2, pt.y - (s.h * escala) / 2, s.w * escala, s.h * escala);
        });
        ctx.globalAlpha = 1;
        const pos = p.estela[0] ?? p.desde;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(Math.sin(e * Math.PI) * 0.12 * (p.hasta.x >= p.desde.x ? 1 : -1));
        ctx.drawImage(s.canvas, (-s.w * escala) / 2, (-s.h * escala) / 2, s.w * escala, s.h * escala);
        ctx.restore();
      } else {
        const p01 = Math.min(1, (this.tiempoSim - (p.tImpacto ?? 0)) / MS_DESVANECER);
        ctx.globalAlpha = 1 - p01 * p01;
        ctx.save();
        ctx.translate(p.body.position.x, p.body.position.y);
        ctx.rotate(p.body.angle);
        ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  private dibujarLadrillo(l: Ladrillo) {
    const { ctx } = this;
    const { x, y } = l.body.position;
    const s = l.sprite;
    ctx.save();
    ctx.translate(x, y);
    if (l.body.angle) ctx.rotate(l.body.angle);
    ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }
}
