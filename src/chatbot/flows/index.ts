import { createFlow } from "@builderbot/bot";
import { welcome } from "./welcome.flow";
import { mainCourse } from "./mainCourse.flow";
import { snack } from "./snack.flow";
import { combo } from "./combo.flow";
import { orderStatus } from "./orderStatus.flow";
import { info } from "./info.flow";
import { confirmation } from "./confirmation.flow";
import { drink } from "./drink.flow";
import { menu } from "./menu.flow";

export default createFlow([
  welcome,
  mainCourse,
  snack,
  combo,
  orderStatus,
  info,
  confirmation,
  drink,
  menu
]);
