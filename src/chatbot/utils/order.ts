interface OrderItem {
  producto: string;
  cantidad?: number;
  peso?: string;
}

function validateOrder(
  order: OrderItem[],
  validProducts: string[]
): string | boolean {
  if (!Array.isArray(order) || order.length === 0) {
    return false;
  }

  if (order[0].producto === "undefined") {
    return false;
  }

  for (const item of order) {
    if (
      !item.producto ||
      !validProducts.includes(item.producto.toLowerCase())
    ) {
      return false;
    }

    if (typeof item.cantidad !== "number" && typeof item.peso !== "string") {
      return "missing-quantity";
    }
  }

  return true;
}

function flatProducts(products) {
  return products.flatMap((category) =>
    category.products.map((product) => ({
      ...product,
      category: category.category,
    }))
  );
}

function formatProducts(products) {
  return products
    .map((product, index) => {
      let productMessage =
        `${index + 1}️⃣ *${product.name}*\n` +
        `${product.description}\n` +
        `Incluye ${product.includes.toLowerCase()}\n`;

      if (Array.isArray(product.options) && product.options.length > 0) {
        const optionsMessage = product.options
          .map((option) => {
            let pricePerUnit = option.price;

            // Check for the "medio" case (min: 0.5 and max: 0.5)
            if (option.min === 0.5 && option.max === 0.5) {
              return `medio = $${pricePerUnit.toFixed(2)}`;
            }

            // For other kilo or unidad types with ranges
            if (product.type === "kilo" || product.type === "unidad") {
              if (option.max && option.min !== option.max) {
                return `${option.min}-${option.max} = $${pricePerUnit.toFixed(2)}`;
              } else {
                return `${option.min} = $${pricePerUnit.toFixed(2)}`;
              }
            }

            return `${option.min}${option.max ? `-${option.max}` : ""} = $${pricePerUnit.toFixed(2)}`;
          })
          .filter((message) => message.trim() !== "")
          .join(", ");
        productMessage += optionsMessage;
      }
      return productMessage.trim();
    })
    .join("\n\n");
}

function formatOrder(orderList) {
  const orderDetails = [];
  orderList.forEach((item) => {
    const productName = item.name || "Producto desconocido";
    let quantityText = "";

    if (item.type === "kg") {
      if (item.quantity) {
        quantityText = `${item.quantity} kilo${item.quantity > 1 ? "s" : ""}`;
      } else {
        quantityText = "Cantidad no especificada";
      }
    } else if (item.type === "unidad") {
      if (item.quantity) {
        quantityText = `${item.quantity} unidad${item.quantity > 1 ? "es" : ""}`;
      } else {
        quantityText = "Cantidad no especificada";
      }
    }

    const totalCost = item.totalCost || 0; // Default to 0 if totalCost is missing
    orderDetails.push(
      `${productName} - ${quantityText} = $${totalCost.toFixed(2)}`
    );
  });

  return orderDetails;
}

const paymentConfirmation = (
  name,
  address,
  phone,
  paymentMethod,
  orderDetails,
  totalOrderCost,
  changeAmount?
) => {
  const payment =
    paymentMethod === "tarjeta"
      ? "tarjeta"
      : `efectivo (cambio para $${
          paymentMethod === "efectivo" ? changeAmount : 0
        })`;

  return [
    `Gracias, *${name}*. Tu pedido ha sido confirmado para envío a:\n` +
      `🏠 Dirección: ${address}\n` +
      `📞 Teléfono: ${phone}\n` +
      `💰 Método de pago: ${payment}`,
    `Tu pedido actual es:\n${orderDetails}`,
    `El costo total de tu pedido es de $${totalOrderCost.toFixed(2)}.`,
  ];
};

export {
  OrderItem,
  validateOrder,
  flatProducts,
  formatProducts,
  formatOrder,
  paymentConfirmation,
};
