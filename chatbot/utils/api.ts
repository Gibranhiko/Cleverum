const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL;
const CHATBOT_SECRET_KEY = process.env.CHATBOT_SECRET_KEY;

const headers = {
  "Content-Type": "application/json",
  "x-chatbot-secret": CHATBOT_SECRET_KEY,
};

export const sendOrder = async (orderData) => {
  try {
    const response = await fetch(`${WEB_PUBLIC_URL}api/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(orderData),
    });

    // Check if response is not OK (covers all non-2xx responses)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Just return the parsed JSON response
    return await response.json();
  } catch (error) {
    console.error("Error sending order to API:", error);
    throw error;
  }
};

export const fetchProducts = async () => {
  try {
    const response = await fetch(`${WEB_PUBLIC_URL}api/products`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    //console.log("Fetched products:", data);
    return data;
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
    const response = await fetch(`${WEB_PUBLIC_URL}api/profile`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    //console.log("Fetched profile:", data);
    return data;
  } catch (error) {
    console.error("Error fetching profile from API:", error);
    throw error;
  }
};
