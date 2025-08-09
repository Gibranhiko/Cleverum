import { addKeyword, EVENTS } from "@builderbot/bot";
import { fetchProducts, fetchProfile } from "../utils/api";
import { aiFlow } from "./ai.flow";
import { fixed } from "./fixed/fixed.flow";
import { toggleFlow } from "./fixed/toggle.flow";

const CACHE_EXPIRY_TIME = 10 * 60 * 1000;
const CMD = new Set(["botoff", "status", "boton"]);

const welcome = addKeyword(EVENTS.WELCOME)
  .addAction(async (ctx, { state, endFlow, gotoFlow }) => {
    const txt = (ctx.body || "").trim().toLowerCase();

    if (CMD.has(txt)) {
      return gotoFlow(toggleFlow);
    }

    if (state.get<boolean>("botOffForThisUser")) {
      return endFlow();
    }
  })
  .addAnswer("🤖...", null, async (_, { state, gotoFlow }) => {
    try {
      let profile = state.get("currentProfile");
      let products = state.get("currentProducts");
      let lastFetch = state.get("lastFetchTime");

      const now = Date.now();
      const isCacheExpired = !lastFetch || now - lastFetch > CACHE_EXPIRY_TIME;

      if (!profile || !products || isCacheExpired) {
        profile = await fetchProfile();
        products = await fetchProducts();
        await state.update({ currentProfile: profile, currentProducts: products, lastFetchTime: now });
      }

      const { useAi } = profile;
      return useAi ? gotoFlow(aiFlow) : gotoFlow(fixed);
    } catch (error) {
      console.error("Failed to fetch profile or update state:", error);
      await state.update({ currentProfile: { useAi: false } });
      return gotoFlow(fixed);
    }
  });

export { welcome };
