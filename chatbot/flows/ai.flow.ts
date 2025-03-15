import { addKeyword, EVENTS } from "@builderbot/bot";
import conversationalLayer from "../layers/conversational.layer";
import mainLayer from "../layers/main.layer";

const aiFlow = addKeyword(EVENTS.ACTION)
  .addAction(conversationalLayer)
  .addAction(mainLayer);

export { aiFlow };
