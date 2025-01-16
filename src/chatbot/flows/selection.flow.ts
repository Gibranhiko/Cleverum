import { addKeyword, EVENTS } from "@builderbot/bot";
import { formatOrder, formatProducts } from "../utils/order";
import { confirmation } from "./confirmation.flow";
import { welcome } from "./welcome.flow";

const selection = addKeyword(EVENTS.ACTION)
  .addAnswer(
    `Por favor selecciona un producto:`,
    null,
    async (_, { flowDynamic, state }) => {
      const products = state.get("filteredProducts");

      if (!Array.isArray(products) || products.length === 0) {
        await flowDynamic("No hay productos disponibles en este momento. 🛑");
        return;
      }
      
      await flowDynamic(
        formatProducts(products) + "\n\n0️⃣ *Regresar al menú inicial*"
      );
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state, gotoFlow }) => {
      const products = state.get("filteredProducts");
      const selection = parseInt(ctx.body, 10) - 1;

      if (ctx.body === "0") {
        await flowDynamic("Regresando al menú inicial");
        return await gotoFlow(welcome);
      }

      if (isNaN(selection) || selection < 0 || selection >= products.length) {
        return fallBack(
          "Respuesta inválida, por favor selecciona una opción válida o escribe 0 para regresar al menú inicial."
        );
      }

      const selectedProduct = products[selection];
      await state.update({ currentOrder: selectedProduct });

      const quantityPrompt =
        selectedProduct.type === "unidad"
          ? `¿Cuántas unidades de *${selectedProduct.name}* deseas?`
          : `¿Cuántos kilos deseas pedir de *${selectedProduct.name}*?`;

      await flowDynamic(quantityPrompt);
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const input = ctx.body.trim().toLowerCase();
      const currentOrder = state.get("currentOrder");

      let quantity = parseFloat(input);
      if (isNaN(quantity)) {
        if (input === "medio" || input === "0.5") {
          quantity = 0.5;
        } else {
          return fallBack("Por favor ingresa una cantidad válida.");
        }
      }

      const selectedOption = currentOrder.options.find(
        (option) =>
          quantity >= option.min &&
          (option.max === undefined || quantity <= option.max)
      );

      if (!selectedOption) {
        return fallBack(
          "No se encontró una opción para la cantidad seleccionada."
        );
      }

      const totalCost =
        selectedOption.min === selectedOption.max
          ? selectedOption.price
          : selectedOption.price * quantity;

      await state.update({
        orderList: [
          ...(state.get("orderList") || []),
          { ...currentOrder, quantity, totalCost },
        ],
      });

      await flowDynamic(
        `*${quantity} ${currentOrder.name}* agregado al pedido.\n` +
          `Con un costo de $${totalCost.toFixed(2)}\n\n` +
          `¿Deseas agregar otro producto o proceder con tu orden?\n\n` +
          `1️⃣ *Agregar otro producto*\n` +
          `2️⃣ *Proceder con el pedido*\n` +
          `0️⃣ *Cancelar orden*`
      );
    }
  )
  .addAnswer(
    "",
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic, state }) => {
      if (ctx.body === "1") {
        return await gotoFlow(welcome);
      } else if (ctx.body === "2") {
        await flowDynamic("Procediendo con tu pedido...");

        const orderList = state.get("orderList") || [];
        const totalOrderCost = orderList.reduce(
          (sum, item) => sum + item.totalCost,
          0
        );

        const orderDetails = formatOrder(orderList);
        await flowDynamic(
          `Tu pedido actual es:\n${orderDetails.join("\n").trim()}`
        );
        await flowDynamic(
          `El costo total de tu pedido es de $${totalOrderCost.toFixed(2)}.`
        );

        return gotoFlow(confirmation);
      } else if (ctx.body === "0") {
        await flowDynamic("Orden cancelada.");
        await state.update({
          orderList: [],
          currentOrder: null,
        });
        return await gotoFlow(welcome);
      } else {
        return fallBack("Por favor selecciona una opción válida: 1, 2 o 0.");
      }
    }
  );

export { selection };
