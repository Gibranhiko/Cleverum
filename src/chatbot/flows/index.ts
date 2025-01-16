import { createFlow } from "@builderbot/bot";
import { welcome } from "./welcome.flow";
import { selection } from "./selection.flow";
import { confirmation } from "./confirmation.flow";

export default createFlow([
  welcome,
  selection,
  confirmation
]);
