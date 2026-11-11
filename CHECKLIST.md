# Checklist — El Muro

## 1. Deploy en Vercel (una sola vez)

- [ ] Proyecto importado desde GitHub (`Andexeros/actividad-inicio`, rama `main`). Cada push a `main` se deploya solo.
- [ ] Integración **Supabase** conectada (región São Paulo, plan Free).
- [ ] Migraciones aplicadas: `npm run migrar` desde la compu (o los 3 SQL de `supabase/migrations/` en el SQL Editor, en orden).
- [ ] **Settings → Environment Variables** (Production y Preview):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `..._PUBLISHABLE_KEY`). Las crea la integración; sin ellas el celular y la TV no se actualizan en vivo.
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`). También la crea la integración.
  - [ ] `ADMIN_PIN`: tu PIN (4 a 8 números).
  - [ ] `HOST_PIN`: el PIN general de los líderes.
  - [ ] `SESSION_SECRET`: 16+ caracteres al azar (`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`). Si lo cambiás, se cierran todas las sesiones de líderes y admin.
  - [ ] `NEXT_PUBLIC_SITE_URL`: la URL pública, por ejemplo `https://actividadbiblica.vercel.app` (es la que va en el QR).
- [ ] **Settings → Functions → Function Region**: São Paulo (`gru1`), la misma región que Supabase.
- [ ] Dominio: el nombre del proyecto define `<nombre>.vercel.app`. Para otro, **Settings → Domains**.
- [ ] Después de cambiar variables o región: **Deployments → ⋯ → Redeploy**.
- [ ] Abrir `/`, `/isla`, `/isla/tv`, `/isla/host` y `/admin` en el dominio final y entrar a admin con el PIN.

> Seguridad: las claves de Supabase y la contraseña de la base no deben compartirse. Si alguna quedó expuesta (por ejemplo, pegada en un chat), regenerala en Supabase (**Settings → API Keys**, **Database → Reset password**) y actualizá `.env.local`; la integración actualiza Vercel.

## 2. Prueba con celulares reales (antes del día)

- [ ] Con el sitio publicado, escanear el QR de la TV con 2 o 3 celulares distintos (Android y iPhone).
- [ ] Escribir y enviar: vibra y muestra "Tu ladrillo ya está en el muro 🧱"; el contador de la TV sube en menos de 1 s.
- [ ] Desde el panel del líder, pasar de pregunta: el celular cambia solo, sin recargar.
- [ ] Bloquear el celular, desbloquearlo: vuelve a la pregunta actual.
- [ ] Probar una mala palabra: no aparece en la TV, el líder la ve como "filtro automático".
- [ ] En la TV, construir el muro, recargar la página: aparece igual, sin repetir la animación.
- [ ] Fase 2: enviar respuestas, ver los proyectiles y la barra; probar el derrumbe y el versículo.
- [ ] Al terminar: **Reiniciar actividad** en cada iglesia (las respuestas de prueba quedan guardadas pero no se muestran).

## 3. Día de la actividad (en cada iglesia)

**Antes de que lleguen los chicos**
- [ ] Correr `npm run chequeo` (o entrar a `/admin`): las 3 iglesias en "Inicio".
- [ ] Notebook conectada a la TV, con cargador, Wi-Fi o datos estables.
- [ ] Abrir `/<iglesia>/tv` en Chrome, tocar **Pantalla completa** y después **Activar sonido** (los navegadores no dejan sonar nada hasta un clic). Subir el volumen.
- [ ] La pantalla no se apaga sola: la TV lo pide al navegador. Igual, desactivar el ahorro de energía de la notebook.
- [ ] El líder entra a `/<iglesia>/host` en su celular con su PIN (sesión de 12 h).
- [ ] Escanear el QR con un celular de prueba: ver "Esperando que empiece…" y el contador de "conectados" en la TV.

**Durante**
- [ ] Poner pantalla completa **antes** de "Construir el muro": si la ventana cambia de tamaño mientras se construye, el muro se completa de golpe.
- [ ] Si algo se traba: recargar la TV. Siempre recupera el estado exacto, no repite animaciones.
- [ ] Si se cae internet en la TV, aparece "Reconectando…" y se pone al día sola al volver.

**Si algo falla**
- Celular sin conexión: recargar la página; la dirección corta está debajo del QR.
- Líder que perdió el panel: volver a entrar con el PIN desde otro celular (la sesión dura 12 h). El admin no puede manejar iglesias: conviene que cada líder tenga su PIN a mano.
- Respuesta inapropiada en pantalla: **Ocultar** desde el panel (antes de construir el muro desaparece de la TV; después, el muro queda como está).

## 4. Después

- [ ] `/admin` → **Respuestas → Exportar CSV** para guardar todo (incluye actividades anteriores).
- [ ] `/admin` → **Combinado** para ver la nube y el ranking de las 3 iglesias juntas.
