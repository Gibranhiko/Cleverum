import axios from "axios";

const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL;
const CHATBOT_SECRET_KEY = process.env.CHATBOT_SECRET_KEY;

const axiosInstance = axios.create({
  baseURL: WEB_PUBLIC_URL,
  headers: {
    "x-chatbot-secret": CHATBOT_SECRET_KEY,
  },
});

export const sendOrder = async (orderData) => {
  try {
    const response = await axiosInstance.post(
      `${WEB_PUBLIC_URL}api/orders`,
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
    const response = await axiosInstance.get(`${WEB_PUBLIC_URL}api/products`);
    console.log("Fetched products:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching products from API:",
      error.response?.data || error
    );
    throw error;
  }
};

export const fetchProfile = async () => {
  try {
    const response = await axiosInstance.get(`${WEB_PUBLIC_URL}api/profile`);
    console.log("Fetched profile:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching profile from API:", error);
    throw error;
  }
};
