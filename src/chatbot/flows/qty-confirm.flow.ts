import { addKeyword, EVENTS } from "@builderbot/bot";
import { flowConfirm } from "./confirm.flow";

const flowConfirmQty = addKeyword(EVENTS.ACTION)
  .addAction(async (_, { flowDynamic }) => {
    await flowDynamic("Cuantas unidades te gustaría pedir?");
  })
  .addAction({ capture: true }, async (ctx, { state, flowDynamic }) => {
    const awaitingQtyFor = state.get("awaitingQtyFor");
    const awaitingWeightFor = state.get("awaitingWeightFor");

    if (awaitingQtyFor) {
      const missingQtyMsg = `¿Cuántas unidades de ${awaitingQtyFor} te gustaría pedir?`;
      await flowDynamic(missingQtyMsg);
    } else if (awaitingWeightFor) {
      const missingWeightMsg = `¿Cuanta ${awaitingWeightFor} te gustaría pedir? (Ej. 1/2 kilo, 1 kilo)`;
      await flowDynamic(missingWeightMsg);
    }
  })
  .addAction(
    { capture: true },
    async (ctx, { state, flowDynamic, gotoFlow }) => {
      const awaitingQtyFor = state.get("awaitingQtyFor");
      const awaitingWeightFor = state.get("awaitingWeightFor");
      const pendingOrder = state.get("pendingOrder");

      if (awaitingQtyFor) {
        const qty = parseInt(ctx.body, 10); // Capture the quantity input
        if (isNaN(qty)) {
          await flowDynamic("Por favor, ingresa una cantidad válida.");
          return;
        }

        // Update the pending order with the specified quantity
        const updatedOrder = pendingOrder.map((item) =>
          item.producto === awaitingQtyFor ? { ...item, cantidad: qty } : item
        );

        await state.update({
          pendingOrder: updatedOrder,
          awaitingQtyFor: null,
        });
      } else if (awaitingWeightFor) {
        const weight = ctx.body; // Capture the weight input as a string (e.g., "1 kilo")
        if (!weight) {
          await flowDynamic("Por favor, ingresa un peso válido.");
          return;
        }

        // Update the pending order with the specified weight
        const updatedOrder = pendingOrder.map((item) =>
          item.producto === awaitingWeightFor ? { ...item, peso: weight } : item
        );

        await state.update({
          pendingOrder: updatedOrder,
          awaitingWeightFor: null,
        });
      }

      // Proceed to order confirmation
      return gotoFlow(flowConfirm);
    }
  );

export { flowConfirmQty };
