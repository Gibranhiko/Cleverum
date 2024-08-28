import { createFlow } from "@builderbot/bot";
import { welcomeFlow } from "./welcome.flow";
import { flowSeller } from "./seller.flow";
import { flowTalker } from "./talker.flow";
import { flowConfirm } from "./confirm.flow";

export default createFlow([welcomeFlow, flowTalker, flowSeller, flowConfirm]);