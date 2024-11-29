import { createFoodFlow } from "./flow-generator/createFoodFlow";

const products = [
  {
    category: "Combos",
    products: [
      {
        name: "Combo Pollo y Top Sirloin",
        description: "Un pollo entero y 1 kg de top sirloin con acompañamientos.",
        type: "unidad",
        options: [
          { min: 1, price: 660.0 }
        ],
        includes: "Incluye una salchicha, cebolla asada, pico de gallo, chile toreado y tortillas."
      },
      {
        name: "Combo Costilla, Top Sirloin y Pollo",
        description: "1 kg de costilla de puerco, 1 kg de top sirloin y un pollo.",
        type: "unidad",
        options: [
          { min: 1, price: 800.0 }
        ],
        includes: "Incluye tres salchichas, cebolla asada, salsas, limón, chile toreado y tortillas."
      }
    ]
  }
]

export const combo = createFoodFlow(products);
