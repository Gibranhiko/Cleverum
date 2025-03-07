import { addKeyword, EVENTS } from "@builderbot/bot";
import { clearHistory } from "../../utils/handleHistory";
import { format } from "date-fns";

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

    const orderData = {
      nombre: state.get("name"),
      orden: state.get("order"),
      telefono: state.get("phone"),
      fecha: format(new Date(), "yyyy-MM-dd HH:mm"),
      status: false,
    };

    console.log("Order data:", orderData);

    try {
      const response = await fetch(`${process.env.WEB_PUBLIC_URL}api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      await flowDynamic(
        "Listo! tu orden esta en proceso, te contactaremos para confirmar el tiempo de entrega"
      );
    } catch (error) {
      console.log("Error creating order:", error.response);
      await flowDynamic(
        "Hubo un problema al procesar tu pedido. Por favor intenta nuevamente."
      );
    }
    clearHistory(state);
  });

export { flowConfirm };



import { addKeyword, EVENTS } from "@builderbot/bot";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import * as path from "path";
import fs from "fs";
import { generateTimer } from "../../utils/generateTimer";
import { format } from "date-fns";

const orderPromptPath = path.join("prompts", "/prompt-order.txt");
const orderPromptData = fs.readFileSync(orderPromptPath, "utf-8");
const PROMPT_ORDER = orderPromptData;

export const generatePromptOrder = (
  history: string,
  businessData: { companyName: string },
  products: string
) => {
  return PROMPT_ORDER.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessData.companyName)
    .replace("{PRODUCTS}", products);
};

const project = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai;
      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);
      const products = state.get("currentProducts");

      // Generate prompt for AI
      const promptInfo = generatePromptOrder(history, businessData, products);

      // Step 1: First, use createChatFn to generate a response
      const response = await ai.createChat(
        [{ role: "system", content: promptInfo }],
        "gpt-4-turbo"
      );

      await handleHistory({ content: response, role: "assistant" }, state);
      const chunks = response.split(/(?<!\d)\.\s+/g);
      for (const chunk of chunks) {
        await flowDynamic([
          { body: chunk.trim(), delay: generateTimer(150, 250) },
        ]);
      }

      console.log("Chat response:", response); // Log chat response

      // Step 2: Pass the chat response to determineOrderFn to extract order details
      const { order } = await ai.determineOrderFn(
        [{ role: "system", content: response }],
        "gpt-4-turbo"
      );

      console.log(order, '### Order'); // Log order details

      if (!order.name || !order.phone || !order.details) {
        await flowDynamic("Ok. ¿Podrías confirmarme tu nombre, teléfono y una breve descripción del proyecto?");
        return;
      }

      // Save data in history
      await handleHistory({ content: JSON.stringify(order), role: "assistant" }, state);

      // Send order data to the API
      const orderData = {
        name: order.name,
        order: order.projectDescription,
        phone: order.phone,
        date: format(new Date(), "yyyy-MM-dd HH:mm"),
        plannedDate: order.plannedDate,
        status: false,
      };

      console.log("Order data:", orderData);

      try {
        const response = await fetch(`${process.env.WEB_PUBLIC_URL}api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (apiError) {
        console.error("Error sending order to API:", apiError);
        await flowDynamic("Hubo un problema enviando tu orden. Inténtalo de nuevo más tarde.");
        return;
      }

      // Send confirmation to the client
      await flowDynamic([
        { body: `Gracias, ${order.name}. Recibimos tu solicitud para: ${order.projectDescription}.`, delay: generateTimer(150, 250) },
        { body: `Te contactaremos al número ${order.phone} en breve.`, delay: generateTimer(150, 250) },
      ]);
    } catch (err) {
      console.error("[ERROR]:", err);
      await flowDynamic("Hubo un problema procesando tu orden. Inténtalo de nuevo.");
    }
  }
);

export { project };

