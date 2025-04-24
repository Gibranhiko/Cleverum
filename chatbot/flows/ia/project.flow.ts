import { addKeyword, EVENTS } from "@builderbot/bot";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import * as path from "path";
import fs from "fs";
import { generateTimer } from "../../utils/generateTimer";
import { format } from "date-fns";
import { sendOrder } from "~/utils/api";
import { initializeSocket, getSocket } from "../../utils/socket-connect"; // Import the shared socket instance

// Initialize the socket when needed
initializeSocket();

// Read the prompt templates once
const promptOrderPath = path.join("prompts", "/prompt-order.txt");
const promptOrderData = fs.readFileSync(promptOrderPath, "utf-8");

const promptDetermineOrderPath = path.join(
  "prompts",
  "/prompt-determine-order.txt"
);
const promptDetermineOrderData = fs.readFileSync(
  promptDetermineOrderPath,
  "utf-8"
);

// Unified function for generating prompts based on template type
const generatePrompt = (
  template: string,
  history: string,
  businessData: { companyName: string },
  products: string,
  todayIs: string
) => {
  return template
    .replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessData.companyName)
    .replace("{PRODUCTS}", products)
    .replace("{CURRENTDAY}", todayIs);
};

const project = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai;
      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);

      // Obtener lista de productos de la empresa
      const products = state.get("currentProducts");

      const todayIs = format(new Date(), "yyyy-MM-dd");

      // Generate the prompt for the order processing
      const promptInfo = generatePrompt(
        promptOrderData,
        history,
        businessData,
        products,
        todayIs
      );

      // Request to the AI
      const response = await ai.createChat([
        { role: "system", content: promptInfo },
      ]);

      // Save response to the history
      await handleHistory({ content: response, role: "assistant" }, state);

      // Check if the response includes the {ORDER_COMPLETE} marker
      if (response.includes("{ORDER_COMPLETE}")) {
        // Generate prompt for order details
        const promptInfoDetermine = generatePrompt(
          promptDetermineOrderData,
          history,
          businessData,
          products,
          todayIs
        );

        const { order } = await ai.determineOrderFn([
          { role: "system", content: promptInfoDetermine },
        ]);

        // Prepare the order data
        const orderData = {
          name: order.name,
          description: order.description,
          phone: order.phone,
          date: format(new Date(), "yyyy-MM-dd HH:mm"), // Current date and time
          plannedDate: order.plannedDate,
          status: false,
        };

        // Send order data to the API
        try {
          await sendOrder(orderData);

          const socket = getSocket(); // Get the initialized socket
          if (socket?.connected) {
            console.log("Emitting new order via WebSocket:", orderData);
            socket.emit("new-order", orderData); // Emit the order via WebSocket
          } else {
            console.error("Socket not connected");
          }

          await flowDynamic(
            "Tu orden ha sido enviada, nos pondremos en contacto muy pronto."
          );
        } catch (error) {
          console.error("Error sending order data:", error.message);
          await flowDynamic(
            "Hubo un problema al procesar tu orden. Inténtalo de nuevo."
          );
        }
      } else {
        // If the order is not complete, continue asking for more information
        const chunks = response.split(/(?<!\d)\.\s+/g);
        for (const chunk of chunks) {
          await flowDynamic([
            { body: chunk.trim(), delay: generateTimer(150, 250) },
          ]);
        }
      }
    } catch (err) {
      console.error("[ERROR]:", err);
      await flowDynamic(
        "Hubo un problema procesando tu orden. Inténtalo de nuevo."
      );
    }
  }
);

export { project };
