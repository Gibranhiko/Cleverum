import { addKeyword, EVENTS } from "@builderbot/bot";

export const orderStatus = addKeyword(EVENTS.ACTION).addAnswer(
  "status",
  { capture: true },
  async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
    if (!["1", "2", "3", "0"].includes(ctx.body)) {
      return fallBack(
        "Respuesta invalida, porfavor selecciona una de las opciones (1,2,3) o escribe 0 para regresar al menu inicial"
      );
    }
    switch (ctx.body) {
      case "1":
        return gotoFlow(orderStatus);
      case "2":
        return;
      case "3":
        return;
      case "0":
        return await flowDynamic(
          'Saliendo... puedes volver a entrar escribiendo "Servicios"'
        );
    }
  }
);
