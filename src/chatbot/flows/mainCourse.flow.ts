import { createFoodFlow } from "./flow-generator/createFoodFlow";

const products = [
  {
    category: "Pollo",
    products: [
      {
        name: "Pollo",
        description: "Pollo entero rostizado con la receta de la casa.",
        type: "unidad",
        options: [
          { min: 0.5, max: 0.5, price: 150.0 },
          { min: 1, max: 1, price: 250.0 },
          { min: 2, max: 3, price: 215.0 },
          { min: 4, price: 190.0 },
        ],
        includes: "Incluye tortillas, totopos, limón, salsas y arroz.",
      },
    ],
  },
  {
    category: "Carne",
    products: [
      {
        name: "Costillas de Puerco",
        description: "Costillas de puerco adobadas en su jugo.",
        type: "kilo",
        options: [
          { min: 0.5, max: 0.5, price: 260.0 },
          { min: 1, max: 2, price: 420.0 },
          { min: 3, price: 400.0 },
        ],
        includes:
          "Incluye tortillas, limón, salsas, chile toreado y una salchicha.",
      },
      {
        name: "Top Sirloin",
        description: "Corte de top sirloin a la parrilla.",
        type: "kilo",
        options: [
          { min: 0.5, max: 0.5, price: 260.0 },
          { min: 1, max: 2, price: 430.0 },
          { min: 3, price: 410.0 },
        ],
        includes:
          "Incluye tortillas, cebolla asada, salsas, limón, chile toreado y salchicha.",
      },
    ],
  },
];

export const mainCourse = createFoodFlow(products);
