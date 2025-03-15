import { createFlow } from "@builderbot/bot";
import { welcome } from "./welcome.flow";
import { selection } from "./fixed/selection.flow";
import { confirmation } from "./fixed/confirmation.flow";
import { flowTalker } from "./ia/talker.flow";
import { flowSeller } from "./fixed/seller.flow";
import { fixed } from "./fixed/fixed.flow";
import { aiFlow } from "./ai.flow";
import { flowConfirm } from "./fixed/confirm.flow";
import { project } from "./ia/project.flow";
import { appointment } from "./ia/appointment.flow";
import { products } from "./ia/products.flow";

export default createFlow([
  welcome,
  selection,
  confirmation,
  flowTalker,
  flowSeller,
  fixed,
  aiFlow,
  flowConfirm,
  project,
  appointment,
  products
]);

