import { createFlow } from "@builderbot/bot";
import { welcomeFlow } from "./welcome.flow";
import { flowSeller } from "./seller.flow";
import { flowTalker } from "./talker.flow";
import { flowConfirm } from "./confirm.flow";
import { flowService } from "./service.flow";
import { flowMenu } from "./menu.flow";
import { flowHello } from "./hello.flow";
import { secretPhraseFlow } from "./startStop.flow";
import { flowOrderConfirmation } from "./order-confirm.flow";
import { flowConfirmQty } from "./qty-confirm.flow";

export default createFlow([
  welcomeFlow,
  flowTalker,
  flowSeller,
  flowConfirm,
  flowService,
  flowMenu,
  flowHello,
  secretPhraseFlow,
  flowOrderConfirmation,
  flowConfirmQty
]);
