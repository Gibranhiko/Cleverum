import { addKeyword, EVENTS } from "@builderbot/bot";
import { fetchProducts, fetchClient } from "../utils/api";
import { aiFlow } from "./ai.flow";
import { fixed } from "./fixed/fixed.flow";
import { toggleFlow } from "./fixed/toggle.flow";

const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
const CMD = new Set(["botoff", "status", "boton"]);

const welcome = addKeyword(EVENTS.WELCOME)
  .addAction(async (ctx, { state, endFlow, gotoFlow, extensions }) => {
    const txt = (ctx.body || "").trim().toLowerCase();

    if (CMD.has(txt)) {
      return gotoFlow(toggleFlow);
    }

    if (state.get<boolean>("botOffForThisUser")) {
      return endFlow();
    }
  })
  .addAnswer("🤖...", null, async (_, { state, gotoFlow, extensions }) => {
    try {
      const clientId = extensions.clientId as string;
      if (!clientId) {
        console.error("ClientId not found in extensions");
        return gotoFlow(fixed);
      }

      let client = state.get(`currentClient_${clientId}`);
      let products = state.get(`currentProducts_${clientId}`);
      let lastFetch = state.get(`lastFetchTime_${clientId}`);

      const now = Date.now();
      const isCacheExpired = !lastFetch || now - lastFetch > CACHE_EXPIRY_TIME;

      if (!client || !products || isCacheExpired) {
        client = await fetchClient(clientId);
        products = await fetchProducts(clientId);
        await state.update({
          [`currentClient_${clientId}`]: client,
          [`currentProducts_${clientId}`]: products,
          [`lastFetchTime_${clientId}`]: now
        });
      }

      const { useAi } = client;
      return useAi ? gotoFlow(aiFlow) : gotoFlow(fixed);
    } catch (error) {
      console.error("Failed to fetch client or update state:", error);
      await state.update({ currentClient: { useAi: false } });
      return gotoFlow(fixed);
    }
  });

export { welcome };
