import { createFoodFlow } from "./flow-generator/createFoodFlow";

const products = [
  {
    category: "Pollo Especial",
    products: [
      {
        name: "Nuggets",
        description: "Crujientes nuggets de pollo servidos con ketchup y papas a la francesa.",
        type: "unidad",
        options: [
          { min: 1, price: 150.0 }
        ],
        includes: "Acompañados de papas a la francesa, ketchup y una coronita."
      },
      {
        name: "Alitas",
        description: "Alitas con el sabor de la casa, servidas con apio, zanahoria y aderezo.",
        type: "kilo",
        options: [
          { min: 0.5, max: 0.5, price: 240.0 },
          { min: 1, price: 330.0 }
        ],
        includes: "Acompañados de apio, zanahoria y aderezo a elegir."
      },
      {
        name: "Boneless",
        description: "Jugosos boneless acompañados de papas a la francesa.",
        type: "unidad",
        options: [
          { min: 1, price: 220.0 }
        ],
        includes: "Acompañados de apio, zanahoria y aderezo a elegir."
      },
      {
        name: "Tenders",
        description: "Tiras de pollo empanizadas, perfectas para disfrutar.",
        type: "unidad",
        options: [
          { min: 1, price: 200.0 }
        ],
        includes: "Acompañados de papas a la francesa, ketchup y una coronita."
      }
    ]
  }
]

export const snack = createFoodFlow(products);
