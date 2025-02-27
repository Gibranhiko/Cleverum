import { clearHistory, handleHistory } from "../../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const appointment = addKeyword(EVENTS.ACTION)
  .addAction(async (_, { state, flowDynamic }) => {
    const infoMsg = `Appointment`;

    await handleHistory({ content: infoMsg, role: "assistant" }, state);
    await flowDynamic(infoMsg);
  })
  .addAction(async (_, { state, flowDynamic }) => {
    await clearHistory(state);
    await flowDynamic("Si necesitas algo más solo di hola!");
  });

export { appointment };
