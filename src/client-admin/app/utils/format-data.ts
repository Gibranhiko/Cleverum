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
