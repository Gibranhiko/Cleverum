import { EVENTS, addKeyword } from "@builderbot/bot";
import conversationalLayer from "src/chatbot/layers/conversational.layer";
import mainLayer from "src/chatbot/layers/main.layer";


export const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAction(conversationalLayer)
    .addAction(mainLayer)