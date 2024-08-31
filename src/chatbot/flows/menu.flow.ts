import { clearHistory, handleHistory } from "../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const flowMenu = addKeyword(EVENTS.ACTION).addAction(
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
        media: "https://www.simpleimageresizer.com/_uploads/photos/f51b80a6/rey-del-pollito-menu-1.png",
        delay: 1000, 
      },
    ]);
    await clearHistory(state);
  }
)

export { flowMenu };
