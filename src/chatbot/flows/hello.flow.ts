import { handleHistory } from "../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const flowHello = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic }) => {
    const helloMsg = `Hola Bienvenido al Rey del Pollito 🐔 Selecciona una opción:
    
    1️⃣ *Ordenar plato fuerte (pollo, carne asada, costillas)*
    2️⃣ *Ordenar una botana (nuggets, alitas, boneless, tenders)*
    3️⃣ *Ordenar un combo (pollo y carnes)*
    4️⃣ *Ver estatus de mi pedido*
    5️⃣ *Información de la empresa*`;

    // Registra el mensaje en el historial y lo envía al flujo
    await handleHistory({ content: helloMsg, role: "assistant" }, state);
    await flowDynamic(helloMsg);
  }
);

export { flowHello };
