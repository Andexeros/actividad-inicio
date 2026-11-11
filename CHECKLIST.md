# Checklist — El Muro

## 1. Vercel (una sola vez)

- [ ] Proyecto conectado a GitHub (`Andexeros/actividad-inicio`, rama `main`): cada push se publica solo.
- [ ] Integración **Supabase** conectada (São Paulo).
- [ ] Entrar a `/admin` con el PIN **1234**.
- [ ] (Recomendado) Cambiarlo: **Settings → Environment Variables → `ADMIN_PIN`** con otro PIN de 4 a 8 números, y **Redeploy**.

> Las claves de Supabase no se comparten. Si alguna quedó expuesta (por ejemplo, pegada en un chat), regenerala en Supabase y actualizá `.env.local`; la integración actualiza Vercel.

## 2. Prueba con celulares reales (antes del día)

- [ ] Abrir la TV (`/isla`) en la compu y escanear el QR con 2 o 3 celulares (Android y iPhone).
- [ ] **Avanzar →** a Pregunta 1: los celulares cambian solos. Responder: el contador de la TV sube al instante.
- [ ] Bloquear y desbloquear un celular: vuelve a la pregunta actual.
- [ ] Una mala palabra no aparece en la TV.
- [ ] Avanzar hasta Muro, recargar la TV: el muro aparece igual, sin repetir la animación.
- [ ] Fase 2: responder y ver los proyectiles; probar Derrumbe y el versículo; **← Retroceder** y volver.
- [ ] Al terminar: `/admin` → **Respuestas → Empezar de cero → Todas las iglesias** (borra las respuestas de prueba y deja todo en Inicio).

## 3. Día de la actividad (en cada iglesia)

**Antes**
- [ ] `npm run chequeo` o `/admin`: las iglesias en Inicio.
- [ ] Notebook conectada a la tele, con cargador e internet estable.
- [ ] Abrir `/<iglesia>` en Chrome → **Pantalla completa** → **Activar sonido** → subir el volumen.
- [ ] Escanear el QR con un celular de prueba: en la TV aparece "1 conectado".

**Durante**
- [ ] Avanzar con el botón, la flecha → o un puntero de presentaciones.
- [ ] Pantalla completa **antes** de llegar a Muro (si la ventana cambia de tamaño mientras se construye, se completa de golpe).
- [ ] Si se avanzó de más: **← Retroceder**.
- [ ] Si algo se traba: recargar la TV (vuelve exactamente donde estaba).

## 4. Después

- [ ] `/admin` → **Respuestas → Exportar CSV**.
- [ ] `/admin` → **Combinado** para la nube y el ranking de las 3 iglesias.
