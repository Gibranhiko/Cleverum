import { addKeyword, EVENTS } from "@builderbot/bot";
import { clearHistory } from "../utils/handleHistory";
import { writeRow } from "src/services/sheets/sheets";
import { format } from 'date-fns';

const flowConfirm = addKeyword(EVENTS.ACTION)
  .addAction(async (_, { flowDynamic }) => {
    await flowDynamic("Ok, voy a pedirte unos datos para iniciar tu pedido");
    await flowDynamic("¿Cual es tu nombre?");
  })
  .addAction(
    { capture: true },
    async (ctx, { state, flowDynamic, endFlow }) => {
      await state.update({ name: ctx.body });

      if (ctx.body.toLocaleLowerCase().includes("cancelar")) {
        clearHistory(state);
        return endFlow(`¿Como puedo ayudarte?`);
      }

      await flowDynamic(`Y por último cuál es tu teléfono?`);
    }
  )
  .addAction({ capture: true }, async (ctx, { state, flowDynamic }) => {
    await state.update({ phone: ctx.body });

    const clientName = state.get("name");
    const order = state.get("order");
    const phone = state.get("phone");
    const date = format(new Date(), "MMMM do, yyyy, h:mm a");

    await writeRow([clientName, order, phone, date], "Hoja 5!A:ZZ");

    clearHistory(state);
    await flowDynamic("Listo! tu orden esta en proceso, te contactaremos para confirmar el tiempo de entrega");
  });

export { flowConfirm };
