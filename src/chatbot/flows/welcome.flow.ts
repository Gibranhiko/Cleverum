import { addKeyword, EVENTS } from "@builderbot/bot";

// Flujos específicos para cada opción
import { mainCourse } from "./mainCourse.flow";
import { snack } from "./snack.flow";
import { combo } from "./combo.flow";
import { menu } from "./menu.flow";
import { info } from "./info.flow";
import { drink } from "./drink.flow";

const welcome = addKeyword(EVENTS.WELCOME).addAnswer(
  `Hola Bienvenido al Rey del Pollito 🐔 Selecciona una opción:
  
  1️⃣ *Ordenar plato fuerte (pollo, carne asada, costillas)*
  2️⃣ *Ordenar una botana (nuggets, alitas, boneless, tenders)*
  3️⃣ *Ordenar un combo (pollo + carnes y extras)*
  4️⃣ *Ordenar bebidas (refrescos, aguas)*
  5️⃣ *Ver todo el menú*
  6️⃣ *Información de la empresa*`,
  { capture: true },
  async (ctx, { gotoFlow, fallBack }) => {
    // Validación de la respuesta del usuario
    if (!["1", "2", "3", "4", "5", "6"].includes(ctx.body)) {
      return fallBack(
        "Respuesta inválida. Por favor selecciona una de las opciones (1, 2, 3, 4, 5, 6)."
      );
    }
    // Lógica de redirección según la respuesta del usuario
    switch (ctx.body) {
      case "1":
        return gotoFlow(mainCourse);
      case "2":
        return gotoFlow(snack);
      case "3":
        return gotoFlow(combo);
      case "4":
        return gotoFlow(drink);
      case "5":
        return gotoFlow(menu);
      case "6":
        return gotoFlow(info);
    }
  }
);

export { welcome };
