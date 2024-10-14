import { addKeyword, EVENTS } from "@builderbot/bot";
import { handleHistory } from "../utils/handleHistory";
import { flowConfirm } from "./confirm.flow"; // Import the next step flow

const flowOrderConfirmation = addKeyword(EVENTS.ACTION)
  .addAction(
    async ({ state, flowDynamic, endFlow }) => {
      const pendingOrder = state.get("pendingOrder");

      if (!pendingOrder || pendingOrder.length === 0) {
        await flowDynamic("No hay ningún pedido pendiente.");
        return endFlow();
      }

      const formattedOrder = pendingOrder
        .map((item) => `${item.cantidad ?? item.peso} ${item.producto}`)
        .join(", ");

      const formattedOrderMsg = `¿Es correcta tu orden de: ${formattedOrder} ? *si* o *no*`;

      await state.update({ order: formattedOrder });
      await flowDynamic(formattedOrderMsg);
      await handleHistory(
        { content: formattedOrderMsg, role: "assistant" },
        state
      );
    }
  )
  .addAction(
    { capture: true }, // Capture user input
    async ({ body }, { state, flowDynamic, gotoFlow, endFlow }) => {
      // Check if the user confirmed the order with "si"
      if (body.toLowerCase().includes("si")) {
        // Redirect to the flow that collects name and phone
        return gotoFlow(flowConfirm);
      } else {
        // Handle when the user rejects the order
        await flowDynamic(
          "Ok, ¿Qué te gustaría pedir? Si quieres ver el menú, solo dime *menú*"
        );
        await state.update({ pendingOrder: null });
        return endFlow();
      }
    }
  );

export { flowOrderConfirmation };
