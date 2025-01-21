import axios from "axios";

export const sendOrder = async (orderData) => {
  try {
    const response = await axios.post(
      `${process.env.PUBLIC_URL}api/orders`,
      orderData
    );
    console.log("Order API response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending order to API:", error);
    throw error;
  }
};

export const fetchProducts = async () => {
  try {
    const response = await axios.get(`${process.env.PUBLIC_URL}api/products`);
    console.log("Fetched products:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching products from API:", error);
    throw error;
  }
};