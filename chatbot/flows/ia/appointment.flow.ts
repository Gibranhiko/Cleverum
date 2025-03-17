import { addKeyword, EVENTS } from "@builderbot/bot";
import { getHistoryParse, handleHistory } from "../../utils/handleHistory";
import * as path from "path";
import fs from "fs";
import { generateTimer } from "../../utils/generateTimer";
//import { sendAppointment } from "~/utils/api";

// Read the prompt templates once
const promptAppointmentPath = path.join("prompts", "/prompt-appointment.txt");
const promptAppointmentData = fs.readFileSync(promptAppointmentPath, "utf-8");

const promptDetermineAppointmentPath = path.join("prompts", "/prompt-appointment.txt");
const promptDetermineAppointmentData = fs.readFileSync(promptDetermineAppointmentPath, "utf-8");

const generatePrompt = (template, history, businessData, services) => {
  return template.replace("{HISTORY}", history)
    .replace("{BUSINESSDATA.companyName}", businessData.companyName)
    .replace("{SERVICES}", services);
};

const appointment = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, flowDynamic, extensions }) => {
    try {
      const ai = extensions.ai;
      const businessData = state.get("currentProfile");
      const history = getHistoryParse(state);
      const services = state.get("currentServices");
      
      const promptInfo = generatePrompt(promptAppointmentData, history, businessData, services);
      const response = await ai.createChat(
        [{ role: "system", content: promptInfo }]
      );
      
      await handleHistory({ content: response, role: "assistant" }, state);
      
      if (response.includes("{APPOINTMENT_COMPLETE}")) {
        const promptInfoDetermine = generatePrompt(promptDetermineAppointmentData, history, businessData, services);
        const { appointment } = await ai.determineAppointmentFn(
          [{ role: "system", content: promptInfoDetermine }]
        );
        
        const appointmentData = {
          name: appointment.name,
          phone: appointment.phone,
          service: appointment.service,
          date: appointment.date,
          status: false,
        };

        console.log("Appointment data:", appointmentData);

        try {
          //await sendAppointment(appointmentData);
          await flowDynamic("Tu cita ha sido agendada. Nos pondremos en contacto pronto.");
        } catch (error) {
          console.error("Error sending appointment data:", error.message);
          await flowDynamic("Hubo un problema al agendar tu cita. Inténtalo de nuevo.");
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
      await flowDynamic("Hubo un problema procesando tu cita. Inténtalo de nuevo.");
    }
  }
);

export { appointment };
