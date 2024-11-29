import { createFoodFlow } from "./flow-generator/createFoodFlow";

const products = [
  {
    category: "Bebidas",
    products: [
      {
        name: "Coca Cola Regular",
        description: "500 ml de Coca Cola, refrescante y carbonatada.",
        type: "unidad",
        options: [
          { min: 1, price: 40.0 }
        ],
        includes: ""
      },
      {
        name: "Coca Cola Light",
        description: "500 ml de Coca Cola de dieta, refrescante y carbonatada.",
        type: "unidad",
        options: [
          { min: 1, price: 40.0 }
        ],
        includes: ""
      },
      {
        name: "Agua de Jamaica",
        description: "500 ml de refrescante agua sabor natural.",
        type: "unidad",
        options: [
          { min: 1, price: 40.0 }
        ],
        includes: ""
      },
      {
        name: "Agua de Horchata",
        description: "500 ml de refrescante agua sabor natural.",
        type: "unidad",
        options: [
          { min: 1, price: 40.0 }
        ],
        includes: ""
      },
      {
        name: "Agua de Tamarindo",
        description: "500 ml de refrescante agua sabor natural.",
        type: "unidad",
        options: [
          { min: 1, price: 40.0 }
        ],
        includes: ""
      },
    ]
  }
]

export const drink = createFoodFlow(products);
