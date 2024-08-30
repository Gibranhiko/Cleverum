import { handleHistory } from "../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const flowHello = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic }) => {
    const hellowMsg =
      "Hola ¿En que te puedo ayudar?... ¿Quieres ver el menú?, ¿Hacer un pedido?, ¿Consultar horarios?, Dime estoy para ayudarte.";
    await handleHistory({ content: hellowMsg, role: "assistant" }, state);
    await flowDynamic(hellowMsg);
  }
);

export { flowHello };
