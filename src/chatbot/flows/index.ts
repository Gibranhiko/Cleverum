import { createFlow } from "@builderbot/bot";
import { welcomeFlow } from "./welcome.flow";
import { flowSeller } from "./seller.flow";
import { flowTalker } from "./talker.flow";
import { flowConfirm } from "./confirm.flow";
import { flowLocation } from "./location.flow";
import { flowService } from "./service.flow";
import { flowMenu } from "./menu.flow";
import { flowHello } from "./hello.flow";

export default createFlow([
  welcomeFlow,
  flowTalker,
  flowSeller,
  flowConfirm,
  flowLocation,
  flowService,
  flowMenu,
  flowHello,
]);
