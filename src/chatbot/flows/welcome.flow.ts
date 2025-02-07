import { addKeyword, EVENTS } from "@builderbot/bot";
import { fetchProducts, fetchProfile } from "../utils/api";
import { aiFlow } from "./ai.flow";
import { fixed } from "./fixed.flow";

const welcome = addKeyword(EVENTS.WELCOME).addAnswer(
  "🤖...",
  null,
  async (_, { state, gotoFlow }) => {
    try {
      const profile = await fetchProfile();
      const products = await fetchProducts();

      await state.update({ currentProfile: profile });
      await state.update({ currentProducts: products });

      const { useAi } = state.get("currentProfile");

      if (useAi) {
        gotoFlow(aiFlow);
      } else {
        gotoFlow(fixed);
      }
    } catch (error) {
      console.error("Failed to fetch profile or update state:", error);
      await state.update({ currentProfile: { useAi: false } });
      gotoFlow(fixed); 
    }
  }
);

export { welcome };