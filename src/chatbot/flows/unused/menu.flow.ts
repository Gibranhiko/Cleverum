import { clearHistory, handleHistory } from "../../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const menu = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic }) => {
    const menuMsg = "Muy bien, dame un segundo para enviarte nuestro menú...";
    await handleHistory({ content: menuMsg, role: "assistant" }, state);
    await flowDynamic(menuMsg);
  }
)
.addAction(
  async (_, { state, flowDynamic }) => {
    await flowDynamic([
      {
        media: "https://i.ibb.co/grwsV2m/rey-del-pollito-menu-1.png",
        delay: 1000, 
      },
    ]);
    await clearHistory(state);
  }
)
.addAction(
  async (_, { flowDynamic }) => {
    await flowDynamic("Si necesitas algo más solo di hola!");
  }
)

export { menu };
