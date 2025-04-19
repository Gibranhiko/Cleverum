export const formatPrice = (
  options: { min: number; max?: number; price: number }[]
) => {
  return options
    .map((option) => {
      let pricePerUnit = option.price;
      if (option.min === 0.5) {
        return `Medio = $${pricePerUnit.toFixed(2)}`;
      } else if (option.min === option.max) {
        return `${option.min} = $${pricePerUnit.toFixed(2)} c/u`;
      } else if (option.max) {
        return `${option.min} - ${option.max} = $${pricePerUnit.toFixed(
          2
        )} c/u`;
      } else if (option.min === 4) {
        return `${option.min}+ = $${pricePerUnit.toFixed(2)} c/u`;
      } else {
        return `${option.min} = $${pricePerUnit.toFixed(2)} c/u`;
      }
    })
    .join(", ");
};

export const formatDate = (date: Date | string): string => {
  const parsedDate = new Date(date);

  if (isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date provided");
  }

  return parsedDate.toLocaleString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
};

export const obtainIdFromUrl = (url: string): string => {
  const currentUrl = new URL(url);
  const pathParts = currentUrl.pathname.split("/");
  const fileName = pathParts[pathParts.length - 1];
  return fileName.replace("product-", "").replace(".png", "");
};

export function formatOrder(orderList) {
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
