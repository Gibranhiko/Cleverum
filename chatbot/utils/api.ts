const PUBLIC_URL = process.env.PUBLIC_URL;
const CHATBOT_SECRET_KEY = process.env.CHATBOT_SECRET_KEY;


const headers = {
  "Content-Type": "application/json",
  "x-chatbot-secret": CHATBOT_SECRET_KEY,
};

export const sendOrder = async (orderData) => {
  try {
    const response = await fetch(`${PUBLIC_URL}/api/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending order to API:", error);
    throw error;
  }
};

export const fetchProducts = async (clientId: string) => {
  try {
    const response = await fetch(`${PUBLIC_URL}/api/products?clientId=${clientId}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(
      "Error fetching products from API:",
      error.response?.data || error
    );
    throw error;
  }
};

export const fetchClient = async (clientId: string) => {
  try {
    const response = await fetch(`${PUBLIC_URL}/api/clients/${clientId}`, {
      method: "GET",
      headers,
    });
    console.log("Fetch client response:", response);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching client from API:", error);
    throw error;
  }
};
