import { handleHistory } from "../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const flowHello = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic }) => {
    const hellowMsg =     
      `Hola Bienvenido al Rey del Pollito 🐔 ¿En qué te puedo ayudar?...  
      🍽️ ¿Quieres ver el menú?
      🛒 ¿Hacer un pedido?
      🕒 ¿Consultar horarios? 
      Si quieres ser atendido por un humano solo escribe "adios bot" 🛑`;
    await handleHistory({ content: hellowMsg, role: "assistant" }, state);
    await flowDynamic(hellowMsg);
  }
);

export { flowHello };
