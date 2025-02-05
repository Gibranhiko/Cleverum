import { createFlow } from "@builderbot/bot";
import { welcome } from "./welcome.flow";
import { selection } from "./selection.flow";
import { confirmation } from "./confirmation.flow";
import { flowTalker } from "./ia/talker.flow";
import { flowSeller } from "./ia/seller.flow";
import { fixed } from "./fixed.flow";
import { aiFlow } from "./ai.flow";

export default createFlow([
  welcome,
  selection,
  confirmation,
  flowTalker,
  flowSeller,
  fixed,
  aiFlow
]);

