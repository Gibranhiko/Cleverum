import { addKeyword } from "@builderbot/bot";
import { botDisabled, adminDisabledUsers, setBotDisabled, adminPhones } from "../../utils/globalState";

// Palabras: "botoff" enciende/apaga, "status" muestra estado, "globaloff/globalon" para admin, "useroff/useron <phone>" para admin
export const toggleFlow = addKeyword(["botoff", "status", "globaloff", "globalon", "useroff", "useron"])
  .addAction(async (ctx, { state, flowDynamic, endFlow }) => {
    try {
      console.log(`Usuario ${ctx.from} ctx admin`);
      const body = ctx.body.toLowerCase();

      // Admin commands - process regardless of disabled state
      if (body === "globaloff" || body === "globalon") {
        if (!adminPhones.has(ctx.from)) {
          await flowDynamic("❌ No tienes permisos de administrador para este comando.");
          return endFlow();
        }
        const disable = body === "globaloff";
        setBotDisabled(disable);
        await flowDynamic(disable ? "🛑 Bot desactivado globalmente por administrador." : "✅ Bot activado globalmente por administrador.");
        return endFlow();
      }

      if (body.startsWith("useroff ") || body.startsWith("useron ")) {
        if (!adminPhones.has(ctx.from)) {
          await flowDynamic("❌ No tienes permisos de administrador para este comando.");
          return endFlow();
        }
        const parts = ctx.body.split(" ");
        const command = parts[0];
        const phone = parts[1];
        if (phone) {
          const disable = command === "useroff";
          if (disable) {
            adminDisabledUsers.add(phone);
          } else {
            adminDisabledUsers.delete(phone);
          }
          await flowDynamic(disable ? `🛑 Usuario ${phone} desactivado por administrador.` : `✅ Usuario ${phone} activado por administrador.`);
        } else {
          await flowDynamic("❌ Formato incorrecto. Usa: useroff/useron <número>");
        }
        return endFlow();
      }

      // Check disabled states for non-admin commands
      if (adminDisabledUsers.has(ctx.from)) {
        await flowDynamic("🛑 Tu acceso al bot ha sido desactivado por el administrador.");
        return endFlow();
      }

      if (botDisabled) {
        await flowDynamic("🛑 El bot está desactivado por el administrador.");
        return endFlow();
      }

      // User status
      if (body === "status") {
        const curr = state.get<boolean>("botOffForThisUser") || false;
        await flowDynamic(curr
          ? "🛑 El bot está *APAGADO* para ti."
          : "✅ El bot está *ENCENDIDO* para ti."
        );
        return endFlow();
      }

      // User toggle
      const curr = state.get<boolean>("botOffForThisUser") || false;
      const next = !curr;
      await state.update({ botOffForThisUser: next });

      await flowDynamic(
        next
          ? "🛑 Apagué el bot para ti. Escribe *botoff* otra vez para encenderlo."
          : "✅ Encendí el bot para ti. Ya puedo responder."
      );

      if (next) return endFlow();
    } catch (error) {
      console.error("Error in toggle flow:", error);
      await flowDynamic("❌ Ocurrió un error. Inténtalo de nuevo.");
      return endFlow();
    }
  });