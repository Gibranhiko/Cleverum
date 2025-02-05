import { addKeyword, EVENTS } from "@builderbot/bot";
import { fetchProfile } from "../utils/api";
import { aiFlow } from "./ai.flow";
import { fixed } from "./fixed.flow";

const welcome = addKeyword(EVENTS.WELCOME).addAnswer(
  "¡Hola!",
  null,
  async (_, { state, gotoFlow }) => {
    const profile = await fetchProfile();
    await state.update({ currentProfile: profile });
    const {useAi} = state.get("currentProfile");

    if (useAi) {
      gotoFlow(aiFlow)
    } else {
      gotoFlow(fixed)
    }
  }
);
export { welcome };
