import { addKeyword } from "@builderbot/bot";

// Palabras: "botoff" enciende/apaga, "status" muestra estado
export const toggleFlow = addKeyword(["botoff", "status"])
  .addAction(async (ctx, { state, flowDynamic, endFlow }) => {
    const curr = state.get<boolean>("botOffForThisUser") || false;

    if (ctx.body.toLowerCase() === "status") {
      await flowDynamic(curr
        ? "🛑 El bot está *APAGADO* para ti."
        : "✅ El bot está *ENCENDIDO* para ti."
      );
      return endFlow();
    }

    const next = !curr;
    await state.update({ botOffForThisUser: next });

    await flowDynamic(
      next
        ? "🛑 Apagué el bot para ti. Escribe *botoff* otra vez para encenderlo."
        : "✅ Encendí el bot para ti. Ya puedo responder."
    );

    if (next) return endFlow();
  });