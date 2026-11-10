/**
 * Contenido editable de la actividad "El Muro".
 * Cambiá textos acá; no hace falta tocar la base de datos.
 */
export const actividad = {
  titulo: "El Muro",
  subtitulo: "Unidad entre jóvenes de distintas congregaciones",

  fase1: {
    preguntas: [
      "¿Qué actitudes nuestras dificultan o impiden la unidad con otros jóvenes cristianos?",
      "¿Qué genera un prejuicio en mí sobre otros jóvenes de otra congregación?",
      "¿Qué hace otro para que se genere una distancia?",
    ],
    /** Frase que aparece sobre el muro terminado. */
    reflexion: "Esto es lo que nos separa",
    mensajeEnviado: "Tu ladrillo ya está en el muro 🧱",
  },

  fase2: {
    pregunta:
      "¿Qué puedo hacer yo para derribar barreras/muros con otros jóvenes cristianos?",
    mensajeEnviado: "¡Golpe! 💥",
    /** Versículo que aparece detrás del muro derrumbado. Reemplazalo por la versión que uses. */
    versiculo: {
      texto:
        "Porque él es nuestra paz, que de ambos hizo uno, derribando la pared intermedia de separación.",
      cita: "Efesios 2:14",
    },
    /** Cantidad de respuestas de fase 2 que llenan la barra de fuerza al 100%. */
    respuestasParaDerribar: 30,
  },

  muro: {
    /** Mínimo de ladrillos (se completan con ladrillos sin texto). */
    minimoLadrillos: 60,
    /** Milisegundos entre la caída de cada ladrillo al construir. */
    msEntreLadrillos: 150,
  },

  respuestas: {
    maxCaracteres: 25,
    /** Máximo de respuestas por celular para cada pregunta. */
    maxPorPregunta: 10,
  },
} as const;

export type Actividad = typeof actividad;
