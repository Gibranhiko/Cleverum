import { addKeyword, EVENTS } from "@builderbot/bot";
import { fetchProducts, fetchProfile } from "../utils/api";
import { aiFlow } from "./ai.flow";
import { fixed } from "./fixed.flow";

const CACHE_EXPIRY_TIME = 10 * 60 * 1000;

const welcome = addKeyword(EVENTS.WELCOME).addAnswer(
  "🤖...",
  null,
  async (_, { state, gotoFlow }) => {
    try {
      let profile = state.get("currentProfile");
      let products = state.get("currentProducts");
      let lastFetch = state.get("lastFetchTime");

      const now = Date.now();
      const isCacheExpired = !lastFetch || now - lastFetch > CACHE_EXPIRY_TIME;

      if (!profile || !products || isCacheExpired) {
        profile = await fetchProfile();
        products = await fetchProducts();

        console.log(profile, products, 'Fetched from API');

        await state.update({ 
          currentProfile: profile, 
          currentProducts: products,
          lastFetchTime: now 
        });
      } else {
        console.log('Using cached profile and products');
      }

      const { useAi } = profile;

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
