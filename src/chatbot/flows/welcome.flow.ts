import { addKeyword, EVENTS } from "@builderbot/bot";
import { selection } from "./selection.flow";
import { fetchProducts } from "../utils/api";
import { fetchProfile } from "../utils/api";

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

  const menuOptions = Object.keys(categories).map((category, index) => {
    return {
      display: `${index + 1}️⃣ *${category}*`,
      category,
    };
  });

  return menuOptions;
};

const welcome = addKeyword(EVENTS.WELCOME).addAnswer(
  "!Hola¡",
  null,
  async (_, { flowDynamic, endFlow, state }) => {
    try {
      const profile = await fetchProfile();
      const { companyName } = profile;
      const welcomeMessage = `Bienvenido a ${companyName}! \n\n¿Qué te gustaría ordenar hoy?`;
      await flowDynamic(welcomeMessage);
    } catch (error) {
      console.error("Error fetching products or profile", error);

      await flowDynamic(
        "Hubo un problema al obtener los productos, inténtalo de nuevo más tarde."
      );
      return endFlow();
    } 
    try {
      const products = await fetchProducts();
      const menuOptions = generateMenuOptions(products);

      await state.update({ menuOptions: menuOptions });
      await state.update({ products: products });

      if (typeof menuOptions === "string") {
        await flowDynamic(menuOptions);
        return endFlow();
      }
      const answer = menuOptions.map((option) => option.display).join("\n");
      
      await flowDynamic(`Selecciona una opción:\n\n${answer}`);
    } catch (error) {
      console.error("Error fetching products or profile", error);

      await flowDynamic(
        "Hubo un problema al obtener los productos, inténtalo de nuevo más tarde."
      );
      return endFlow();
    }
  }
)
.addAction(
    { capture: true },
    async (ctx, { fallBack, state, gotoFlow}) => { 
      const menuOptions = state.get("menuOptions");
      const products = state.get("products");

      const validOptions = menuOptions.map((_, index) =>
        (index + 1).toString()
      );
      
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

      await state.update({ filteredProducts: filteredProducts });
      
      return gotoFlow(selection);

    });

    export { welcome };


