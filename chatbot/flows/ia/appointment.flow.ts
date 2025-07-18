import { addKeyword, EVENTS } from "@builderbot/bot";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import * as path from "path";
import fs from "fs";
import { generateTimer } from "../../utils/generateTimer";
import { format } from "date-fns";
import { formatPrice } from "~/utils/order";
import { sendOrder } from "~/utils/api";
import { getSocket } from "~/utils/socket-connect";

// Read the prompt templates once
const promptAppointmentPath = path.join("prompts", "/prompt-appointment.txt");
const promptAppointmentData = fs.readFileSync(promptAppointmentPath, "utf-8");

const promptDetermineAppointmentPath = path.join(
  "prompts",
  "/prompt-appointment.txt"
);
const promptDetermineAppointmentData = fs.readFileSync(
  promptDetermineAppointmentPath,
  "utf-8"
);

const generatePrompt = (template, history, businessData, products, todayIs) => {
  return template
    .replace("{HISTORY}", history)
    .replace("{CURRENTDAY}", todayIs)
    .replace("{BUSINESSDATA.companyName}", businessData.companyName)
    .replace("{BUSINESSDATA.companyType}", businessData.companyType)
    .replace("{PRODUCTS}", products);
};

const appointment = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai;
      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);
      const products = state.get("currentProducts");
      const todayIs = format(new Date(), "yyyy-MM-dd HH:mm");

      const formattedProducts = products.map(
        (p) =>
          `${p.name}: ${p.description}, incluye: ${
            p.includes
          }, costo: ${formatPrice(p.options)}, url: ${p.imageUrl}`
      );

      const promptInfo = generatePrompt(
        promptAppointmentData,
        history,
        businessData,
        formattedProducts,
        todayIs
      );

      console.log("Prompt Info Appointment Flow: ", promptInfo);
      
      const response = await ai.createChat([
        { role: "system", content: promptInfo },
      ]);

      await handleHistory({ content: response, role: "assistant" }, state);

      if (response.includes("{APPOINTMENT_COMPLETE}")) {
        const promptInfoDetermine = generatePrompt(
          promptDetermineAppointmentData,
          history,
          businessData,
          products,
          todayIs
        );
        const { appointment } = await ai.determineAppointmentFn([
          { role: "system", content: promptInfoDetermine },
        ]);

        const appointmentData = {
          name: appointment.name,
          description: appointment.service,
          phone: appointment.phone,
          date: format(new Date(), "yyyy-MM-dd HH:mm"),
          plannedDate: appointment.date,
          status: false,
        };

        try {
          await sendOrder(appointmentData);
          const socket = getSocket(); // Get the initialized socket
          if (socket?.connected) {
            console.log("Emitting new order via WebSocket:", appointmentData);
            socket.emit("new-order", appointmentData); // Emit the order via WebSocket
          } else {
            console.error("Socket not connected");
          }
          await flowDynamic(
            "Tu cita ha sido agendada. Nos pondremos en contacto pronto."
          );
        } catch (error) {
          console.error("Error sending appointment data:", error.message);
          await flowDynamic(
            "Hubo un problema al agendar tu cita. Inténtalo de nuevo."
          );
        }
      } else {
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
        "Hubo un problema procesando tu cita. Inténtalo de nuevo."
      );
    }
  }
);

export { appointment };
