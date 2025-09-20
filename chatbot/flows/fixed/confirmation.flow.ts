import { addKeyword, EVENTS } from "@builderbot/bot";
import { formatOrder, paymentConfirmation } from "../../utils/order";
import { sendOrder } from "../../utils/api";

export const confirmation = addKeyword(EVENTS.ACTION)
  .addAnswer(
    `¿Cómo deseas recibir tu pedido?\n\n` +
      `1️⃣ *Envío a domicilio*\n` +
      `2️⃣ *Recoger en tienda*\n` +
      `0️⃣ *Cancelar pedido*`,
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state, endFlow }) => {
      const option = ctx.body.trim();

      if (option === "1") {
        await state.update({
          deliveryMethod: "domicilio",
          latitude: null,
          longitude: null,
          address: "",
          name: "",
          phone: "",
        });
        return await flowDynamic(
          `Por favor, comparte tu *ubicación actual* usando el botón de ubicación de WhatsApp. (No enviar ubicación en tiempo real)`
        );
      } else if (option === "2") {
        await state.update({
          deliveryMethod: "recoger",
          name: "",
          phone: "",
        });
        return await flowDynamic(
          `Perfecto, procede a ingresar tu *nombre completo* para confirmar la recogida.`
        );
      } else if (option === "0") {
        await flowDynamic("Pedido cancelado.");
        await state.update({
          orderList: [],
          currentOrder: null,
        });
        return endFlow();
      } else {
        return fallBack(
          "Por favor selecciona una opción válida: 1, 2 o 0 para cancelar."
        );
      }
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { fallBack, flowDynamic, state }) => {
      const deliveryMethod = state.get("deliveryMethod");

      if (deliveryMethod === "domicilio") {
        if (ctx.message && ctx.message.locationMessage) {
          const { degreesLatitude: latitude, degreesLongitude: longitude } =
            ctx.message.locationMessage;
          await state.update({ latitude, longitude });
        }
        return await flowDynamic(
          `Gracias. Ahora, ¿puedes proporcionar tu *dirección escrita completa*? Incluye calle, número, colonia, municipio y código postal.`
        );
      } else if (deliveryMethod === "recoger") {
        await state.update({ name: ctx.body });
        return await flowDynamic(`¿Cuál es tu *número de teléfono*?`);
      } else {
        return fallBack("Ocurrió un error, intenta de nuevo.");
      }
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { flowDynamic, state, endFlow }) => {
      const deliveryMethod = state.get("deliveryMethod");

      if (deliveryMethod === "domicilio") {
        await state.update({ address: ctx.body });
        return await flowDynamic(`¿Cuál es tu *nombre completo* para el envío?`);
      } else if (deliveryMethod === "recoger") {
        await state.update({ phone: ctx.body });
        const phone = state.get("phone");
        const orderList = state.get("orderList") || [];
        const orderDetails = formatOrder(orderList);
        const name = state.get("name");
        const totalOrderCost = orderList.reduce(
          (sum, item) => sum + item.totalCost,
          0
        );

        const orderData = {
          name: name,
          order: orderList,
          phone: phone,
          date: new Date().toISOString(),
          deliveryType: deliveryMethod,
          total: totalOrderCost,
          status: false
        };

        try {
          await sendOrder(orderData);
        } catch (error) {
          await flowDynamic(
            "Hubo un problema al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.", error
          );
          return endFlow();
        }

        await flowDynamic(
          `Gracias, ${name}. Tu pedido ha sido confirmado para recogida en tienda.`
        );
        await state.update({
          orderList: [],
          currentOrder: null,
        });
        await flowDynamic(`${orderDetails.join("\n").trim()}`);
        await flowDynamic(`El costo total de tu pedido es de $${totalOrderCost.toFixed(2)}.`);
        await flowDynamic(`Te avisaremos cuando tu pedido esté listo. ¡Gracias!`);
        return endFlow();
      }
    }
  )
  .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
    const deliveryMethod = state.get("deliveryMethod");

    if (deliveryMethod === "domicilio") {
      await state.update({ name: ctx.body });
      return await flowDynamic(
        `Finalmente, ¿puedes proporcionar tu *número de teléfono*?`
      );
    }
  })
  .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
    const deliveryMethod = state.get("deliveryMethod");

    if (deliveryMethod === "domicilio") {
      await state.update({ phone: ctx.body });
      return await flowDynamic(
        `¿Cuál será tu *método de pago*?\n\n` +
          `1️⃣ *Tarjeta*\n` +
          `2️⃣ *Efectivo*`
      );
    }
  })
  .addAction(
    { capture: true },
    async (ctx, { flowDynamic, state, endFlow }) => {
      const paymentOption = ctx.body.trim();
      const name = state.get("name");
      const address = state.get("address");
      const latitude = state.get("latitude");
      const longitude = state.get("longitude");
      const deliveryMethod = state.get("deliveryMethod");
      let location: string;
      if (latitude && longitude) {
        location = `https://www.google.com/maps?q=${latitude},${longitude}`;
      }
      const phone = state.get("phone");
      const orderList = state.get("orderList") || [];
      const totalOrderCost = orderList.reduce(
        (sum, item) => sum + item.totalCost,
        0
      );
      const orderDetails = formatOrder(orderList);

      if (paymentOption === "1") {
        await state.update({ paymentMethod: "tarjeta" });
        const paymentMethod = state.get("paymentMethod");
        const messages = paymentConfirmation(
          name,
          address,
          phone,
          "tarjeta",
          orderDetails,
          totalOrderCost
        );
        const orderData = {
          name: name,
          order: orderList,
          phone: phone,
          date: new Date().toISOString(),
          deliveryType: deliveryMethod,
          total: totalOrderCost,
          address: address,
          ...(location && { location: location }),
          status: false,
          paymentMethod: paymentMethod
        };
  
        try {
          await sendOrder(orderData);
        } catch (error) {
          await flowDynamic(
            "Hubo un problema al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.", error
          );
          return endFlow();
        }
        await flowDynamic(messages);
        await flowDynamic(
          `El repartidor llevará una terminal. Gracias por tu pedido.`
        );
        await state.update({
          orderList: [],
          currentOrder: null,
        });
        return endFlow();
      } else if (paymentOption === "2") {
        await state.update({ paymentMethod: "efectivo" });
        return await flowDynamic(`¿Con qué billete pagarás para enviar el cambio?`);
      } else {
        return flowDynamic(
          "Por favor selecciona una opción válida: 1 para *tarjeta* o 2 para *efectivo*."
        );
      }
    }
  )
  .addAction(
    { capture: true },
    async (ctx, { flowDynamic, state, endFlow }) => {
      const paymentMethod = state.get("paymentMethod");

      if (paymentMethod === "efectivo") {
        const changeAmount = parseInt(ctx.body.trim(), 10);

        if (!isNaN(changeAmount) && changeAmount > 0) {
          await state.update({ changeAmount });
        } else {
          return flowDynamic(
            "Por favor ingresa un monto válido para el cambio."
          );
        }
      }

      const name = state.get("name");
      const address = state.get("address");
      const phone = state.get("phone");
      const orderList = state.get("orderList") || [];
      const orderDetails = formatOrder(orderList);
      const changeAmount = state.get("changeAmount");
      const deliveryMethod = state.get("deliveryMethod");
      const latitude = state.get("latitude");
      const longitude = state.get("longitude");
      let location: string;
      if (latitude && longitude) {
        location = `https://www.google.com/maps?q=${latitude},${longitude}`;
      }
      const totalOrderCost = orderList.reduce(
        (sum, item) => sum + item.totalCost,
        0
      );

      const orderData = {
        name: name,
        order: orderList,
        phone: phone,
        date: new Date().toISOString(),
        deliveryType: deliveryMethod,
        total: totalOrderCost,
        address: address,
        ...(location && { location: location }),
        payment: changeAmount,
        status: false,
        paymentMethod: paymentMethod,
        clientPayment: changeAmount
      };

      try {
        await sendOrder(orderData);
      } catch (error) {
        await flowDynamic(
          "Hubo un problema al procesar tu pedido. Por favor, inténtalo de nuevo más tarde.", error
        );
        return endFlow();
      }

      const messages = paymentConfirmation(
        name,
        address,
        phone,
        paymentMethod,
        orderDetails,
        totalOrderCost,
        changeAmount
      );

      await flowDynamic(messages);
      await flowDynamic(
        `El repartidor llevará tu cambio. Gracias por tu pedido.`
      );
      await state.update({
        orderList: [],
        currentOrder: null,
      });
      return endFlow();
    }
  );
