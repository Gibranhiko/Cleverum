import { addKeyword, EVENTS } from "@builderbot/bot";
import { fetchProducts } from "../../utils/api";
import { selection } from "./selection.flow";
import { welcome } from "../welcome.flow";

const generateMenuOptions = (products) => {
  if (products.length === 0) {
    return "No hay productos disponibles en este momento. Por favor, inténtalo más tarde.";
  }
  const categories = {};

  products.forEach((product) => {
    if (!categories[product.category]) {
      categories[product.category] = [];
    }
    categories[product.category].push(product.name);
  });

  return Object.keys(categories).map((category, index) => ({
    display: `${index + 1}️⃣ *${category}*`,
    category,
  }));
};

const fixed = addKeyword(EVENTS.ACTION)
  .addAction(async (_, { state, flowDynamic, endFlow, gotoFlow, extensions }) => {
    const clientId = extensions.clientId as string;
    const client = state.get(`currentClient_${clientId}`);
    const { useAi } = client;
    if (useAi) {
        gotoFlow(welcome);
    }
    try {
      const { companyName } = client;
      const welcomeMessage = `Hola, bienvenido a ${companyName}! \n\n¿Qué te gustaría ordenar hoy?`;
      await flowDynamic(welcomeMessage);

      const products = await fetchProducts(clientId);
      const menuOptions = generateMenuOptions(products);

      await state.update({ menuOptions, products });

      if (typeof menuOptions === "string") {
        await flowDynamic(menuOptions);
        return endFlow();
      }

      const answer = menuOptions.map((option) => option.display).join("\n");
      await flowDynamic(`Selecciona una opción:\n\n${answer}`);
    } catch (error) {
      console.error("Error fetching products or client", error);
      await flowDynamic(
        "Hubo un problema al obtener los productos, inténtalo de nuevo más tarde."
      );
      return endFlow();
    }
  })
  .addAction({ capture: true }, async (ctx, { fallBack, state, gotoFlow }) => {
    const menuOptions = state.get("menuOptions");
    const products = state.get("products");

    const validOptions = menuOptions.map((_, index) => (index + 1).toString());

    if (!validOptions.includes(ctx.body)) {
      return fallBack(
        "Respuesta inválida. Por favor selecciona una de las opciones disponibles."
      );
    }

    const selectedCategoryIndex = parseInt(ctx.body, 10) - 1;
    const selectedCategory = menuOptions[selectedCategoryIndex]?.category;

    const filteredProducts = products.filter(
      (product) => product.category === selectedCategory
    );

    await state.update({ filteredProducts });

    return gotoFlow(selection);
  });

export { fixed };
