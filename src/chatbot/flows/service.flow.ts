import { handleHistory } from "../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const flowService = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic }) => {
    const serviceMsg =
      "Hola, claro estos son nuestros horarios de servicio: \nLunes a Viernes de 9:00 a 18:00 hrs. \nSábados de 9:00 a 14:00 hrs. \nDomingos cerrado.";
    await handleHistory({ content: serviceMsg, role: "assistant" }, state);
    await flowDynamic(serviceMsg);
  }
);

export { flowService };
