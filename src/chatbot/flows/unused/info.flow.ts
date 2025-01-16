import { clearHistory, handleHistory } from "../../utils/handleHistory";
import { addKeyword, EVENTS } from "@builderbot/bot";

const info = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic }) => {
    const infoMsg = `En El Rey del Pollito, ofrecemos los mejores asados de pollo, costillas y carne en San Nicolás de los Garza, N.L. Usamos ingredientes frescos y técnicas tradicionales para brindar una experiencia gastronómica única.

Horarios: Abiertos todos los días de 12 pm a 6 pm.

Contacto:

🏠 Calle Santa Martha 252, Fracc. San Isidro, San Nicolás de los Garza, N.L.
📧 contacto@elreydelpollito.com
📞 8185554321
🌐 www.elreydelpollito.com
📱 Facebook: facebook.com/elreydelpollito
📸 Instagram: instagram.com/elreydelpollito
🐦 Twitter: twitter.com/elreydelpollito

Menú: Ofrecemos pollos enteros, costillas, carne asada y paquetes con acompañamientos como tortillas, salsas y arroz. También tenemos botanas, menús infantiles y bebidas.

Preparación: Marinamos nuestras carnes en especias y las asamos lentamente sobre carbón de mezquite para un sabor ahumado. Los acompañamientos se preparan a diario con recetas tradicionales.

¡Disfruta de un asado auténtico en El Rey del Pollito!`;

    await handleHistory({ content: infoMsg, role: "assistant" }, state);
    await flowDynamic(infoMsg);
  }
)
.addAction(
  async (_, { state, flowDynamic }) => {
    await clearHistory(state);
    await flowDynamic("Si necesitas algo más solo di hola!");
  }
)

export { info };
