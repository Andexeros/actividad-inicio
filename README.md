# El Muro

Actividad interactiva para jóvenes sobre la **unidad entre congregaciones**. Cada iglesia tiene su TV, sus celulares y su líder; un panel admin ve todo.

Stack: Next.js 16 (App Router, TS) · Tailwind 4 · Supabase (Postgres + Realtime) · Matter.js · Framer Motion · Howler.js · qrcode.react.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/` | — | Landing con links a cada iglesia |
| `/[iglesia]` | Chicos (celular) | Responder (URL del QR) |
| `/[iglesia]/tv` | Pantalla grande | Muro, QR, animaciones |
| `/[iglesia]/host` | Líder (PIN) | Control de fases y moderación |
| `/admin` | Admin (PIN) | Las iglesias en vivo |

## Setup

1. **Node 20+** y `npm install`.
2. **Crear un proyecto en [Supabase](https://supabase.com)** (plan free alcanza).
3. **Correr las migraciones**, en orden, en *SQL Editor → New query* (pegar y ejecutar cada archivo):
   - `supabase/migrations/20261110000001_esquema_inicial.sql`
   - `supabase/migrations/20261110000002_iglesias_iniciales.sql`
   - `supabase/migrations/20261110000003_funciones_host.sql`

   (Con la CLI de Supabase: `supabase link` y `supabase db push`.)
4. **Variables de entorno:** copiá `.env.example` a `.env.local` y completá:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → *Project Settings → API*.
   - `ADMIN_PIN`, `HOST_PIN` → PINs numéricos. Cada iglesia puede tener su propio PIN en `iglesias.host_pin`; si está vacío se usa `HOST_PIN`.
   - `SESSION_SECRET` → string al azar de 16+ caracteres (firma las cookies de host/admin). Por ejemplo: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
5. `npm run dev` y abrí http://localhost:3000.

## Panel del líder (`/[iglesia]/host`)

Se entra con el PIN de la iglesia (`iglesias.host_pin`, o `HOST_PIN` si no tiene). La sesión dura 12 h; si se cambia el PIN, se cierran las sesiones abiertas. El admin (`ADMIN_PIN`) también puede usar el panel de cualquier iglesia.

Recorrido apretando el botón principal:

| Fase | Botón principal | Otros botones |
|---|---|---|
| Inicio | Abrir entrada | |
| Fase 1 (P1, P2) | Siguiente pregunta | Cerrar respuestas |
| Fase 1 (P3) | Cerrar respuestas | |
| Fase 1, cerrada | Construir el muro | Siguiente pregunta*, Reabrir respuestas |
| Muro construido | Dar la clase | Pasar a fase 2 |
| Clase | Pasar a fase 2 | |
| Fase 2 | Derribar | Cerrar / Reabrir respuestas |
| Derrumbe | Pantalla final | |
| Final | — (solo reiniciar) | |

\* si quedan preguntas.

- Si dos líderes (o líder + admin) aprietan a la vez, se aplica uno solo y al otro le avisa que la pantalla cambió.
- "Construir el muro" guarda la foto de las respuestas visibles de fase 1: ocultar una respuesta después ya no cambia el muro.
- Lista de respuestas en vivo (incluidas las que ocultó el filtro, marcadas "filtro automático") con Ocultar/Mostrar.
- "Reiniciar actividad" (con confirmación) crea una sesión nueva en Inicio; las respuestas viejas quedan en la base.

## Probar sin panel (consola)

También se puede cambiar la fase por consola:

```bash
npm run fase -- isla fase1 0    # abre la entrada, pregunta 1
npm run fase -- isla fase1 1    # pregunta 2
npm run fase -- isla fase2      # fase 2
npm run fase -- isla cerrar     # cierra la entrada
npm run fase -- isla lobby      # vuelve al inicio
```

- Celular: `http://localhost:3000/isla` · TV mínima: `http://localhost:3000/isla/tv`
- Desde un celular en la misma red: `npm run dev -- -H 0.0.0.0` y entrá con la IP de la compu.
- **Aislamiento entre iglesias:** `npm run probar:aislamiento` abre una conexión Realtime por iglesia, inserta respuestas en paralelo en las 3 y verifica que cada una recibe solo las suyas en menos de 1 s, que las ocultas no llegan y que la anon key no puede escribir. Al final borra las respuestas de prueba.

## Editar textos

Preguntas, frase de reflexión, versículo, tamaño mínimo del muro, etc.: `config/actividad.ts`.

## Modelo de datos

- **iglesias** — `slug`, `nombre`, `host_pin` (el PIN no es legible con la anon key). Al crear una iglesia, un trigger le crea su sesión.
- **sesiones** — una activa por iglesia (índice único parcial). Guarda `fase`, `pregunta_actual`, `entrada_abierta`, la foto del `muro` al construirlo un `version` que se incrementa en cada cambio de fase (si dos líderes aprietan a la vez, el segundo se rechaza) y un `rev_respuestas` que avisa a las pantallas que relean respuestas (moderación y filtradas, que Realtime no avisa). "Reiniciar" desactiva la sesión y crea otra; las respuestas viejas quedan.
- **respuestas** — `fase`, `pregunta`, `texto` (1–25 caracteres, sin espacios al borde), `visible`, `filtrada` (oculta por el filtro automático), `dispositivo` (hash anónimo para el rate limit). `iglesia_id` lo completa un trigger desde la sesión.

### Seguridad

- La **anon key solo lee**: iglesias (sin PIN), sesiones y respuestas visibles.
- **Todas las escrituras van por el servidor** con service role: enviar respuesta (con filtro de malas palabras y rate limit), cambiar fase, moderar, reiniciar. Los cambios de host/admin validan el PIN.
- Realtime: `sesiones` y `respuestas` están en la publicación `supabase_realtime`; los clientes se suscriben filtrando por `iglesia_id`.

## Deploy (Vercel)

Importar el repo en Vercel, cargar las mismas variables de entorno y deployar. Dominio: `actividadbiblica.vercel.app`.
