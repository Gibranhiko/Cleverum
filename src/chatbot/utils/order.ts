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

      if (product.options) {
        const optionsMessage = product.options
          .map((option) => {
            let pricePerUnit = option.price;

            if (product.type === "kilo") {
              if (option.min === 0.5) {
                return `Medio kg = $${pricePerUnit.toFixed(2)} c/u`;
              } else if (option.max) {
                return `${option.min}-${option.max} kg = $${pricePerUnit.toFixed(2)} c/u`;
              } else {
                return `${option.min} kg = $${pricePerUnit.toFixed(2)} c/u`;
              }
            } else if (product.type === "unidad") {
              if (option.min === 0.5) {
                return `Medio = $${option.price.toFixed(2)}`;
              } else if (option.max && option.min !== option.max) {
                return `${option.min}-${option.max} = $${option.price.toFixed(2)} c/u`;
              }
              return `${option.min} = $${option.price.toFixed(2)} c/u`;
            }
            return "";
          })
          .join(", ");

        productMessage += optionsMessage;
      }

      return productMessage;
    })
    .join("\n\n");
}

function formatOrder(orderList) {
  const orderDetails = [];
  orderList.forEach((item) => {
    const productName = item.name;
    let quantityText = "";
    if (item.type === "kilo") {
      quantityText = `${item.quantity} kilo${item.quantity > 1 ? "s" : ""}`;
    } else if (item.type === "unidad") {
      quantityText = `${item.quantity} unidad${item.quantity > 1 ? "es" : ""}`;
    }
    const totalCost = item.totalCost;
    orderDetails.push(
      `${productName} - ${quantityText} = $${totalCost.toFixed(2)}`
    );
  });

  return orderDetails;
}


const paymentConfirmation = (name, address, phone, paymentMethod, orderDetails, totalOrderCost, changeAmount?) => {
  const payment =
    paymentMethod === "tarjeta"
      ? "tarjeta"
      : `efectivo (cambio para $${paymentMethod === "efectivo" ? changeAmount : 0})`;

  return [
    `Gracias, *${name}*. Tu pedido ha sido confirmado para envío a:\n` +
      `🏠 Dirección: ${address}\n` +
      `📞 Teléfono: ${phone}\n` +
      `💰 Método de pago: ${payment}`,
    `Tu pedido actual es:\n${orderDetails}`,
    `El costo total de tu pedido es de $${totalOrderCost.toFixed(2)}.`,
  ];
};

export { OrderItem, validateOrder, flatProducts, formatProducts, formatOrder, paymentConfirmation };
