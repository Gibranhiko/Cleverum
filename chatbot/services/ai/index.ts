import { OpenAI } from "openai";
import fs from "fs";
import { ChatCompletionMessageParam } from "openai/resources/chat";

interface Order {
  name: string;
  order?: string;
  description: string;
  phone: string;
  date: string;
  plannedDate?: string;
  address?: string;
  location?: string;
  paymentMethod?: string;
  clientPayment?: number;
  total?: number;
  status: boolean;
}

interface OrderResponse {
  order: Order;
}

class AIClass {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, _model: string) {
    this.openai = new OpenAI({ apiKey, timeout: 15 * 1000 });
    if (!apiKey || apiKey.length === 0) {
      throw new Error("OPENAI_KEY is missing");
    }

    this.model = _model;
  }

  /**
   *
   * @param path
   * @returns
   */
  voiceToText = async (path: fs.PathLike) => {
    if (!fs.existsSync(path)) {
      throw new Error("No se encuentra el archivo");
    }

    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(path),
        model: "whisper-1",
      });

      return transcription.text;
    } catch (err) {
      console.log(err.response.data);
      return "ERROR";
    }
  };

  /**
   *
   * @param messages
   * @param model
   * @param temperature
   * @returns
   */
  createChat = async (
    messages: ChatCompletionMessageParam[],
    model?: string,
    temperature = 0
  ) => {
    try {
      const completion = await this.openai.chat.completions.create({
        model: model ?? this.model,
        messages,
        temperature,
        max_tokens: 256,
        top_p: 0,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      return completion.choices[0].message.content;
    } catch (err) {
      console.error(err);
      return "ERROR";
    }
  };

  determineIntentFn = async (
    messages: ChatCompletionMessageParam[],
    model?: string,
    temperature = 0
  ): Promise<{ intent: string }> => {
    try {
      const completion = await this.openai.chat.completions.create({
        model: model ?? this.model,
        temperature,
        messages,
        functions: [
          {
            name: "fn_get_intent",
            description: "Classify the user's intent based on the message",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  description: "The detected user intent.",
                  enum: [
                    "proporcionar_detalles_proyecto",
                    "agendar_cita",
                    "consultar_servicios",
                    "hablar",
                  ],
                },
              },
              required: ["intent"],
            },
          },
        ],
        function_call: { name: "fn_get_intent" },
      });

      const functionCall = completion.choices?.[0]?.message?.function_call;
      if (!functionCall || !functionCall.arguments) {
        throw new Error("No function call response received from AI.");
      }

      let response;
      try {
        response = JSON.parse(functionCall.arguments);
      } catch (jsonError) {
        throw new Error(
          `Failed to parse function_call arguments: ${jsonError}`
        );
      }

      return response;
    } catch (err) {
      console.error("Error determining intent:", err);
      return { intent: "otros" };
    }
  };

  determineOrderFn = async (
    messages: ChatCompletionMessageParam[],
    model?: string,
    temperature: number = 0
  ): Promise<OrderResponse> => {
    try {
      const completion = await this.openai.chat.completions.create({
        model: model ?? this.model,
        temperature,
        messages,
        functions: [
          {
            name: "fn_create_order",
            description: "Extracts the necessary information to create a service request.",
            parameters: {
              type: "object",
              properties: {
                order: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Customer's full name." },
                    phone: { type: "string", description: "Customer's phone number." },
                    description: { type: "string", description: "Brief description of the project the customer wants to develop." },
                    plannedDate: { 
                      type: "string", 
                      format: "date-time", 
                      description: "Planned start or delivery date, if provided by the customer." 
                    }
                  },
                  required: ["name", "phone", "description"]
                }
              },
              required: ["order"]
            }
          }
        ],
        function_call: { name: "fn_create_order" }
      });
  
      // Validar si la respuesta tiene datos
      const choice = completion.choices?.[0];
      if (!choice?.message?.function_call?.arguments) {
        throw new Error("No se recibió una respuesta válida de la IA.");
      }
  
      // Convertir JSON response a objeto
      const response: OrderResponse = JSON.parse(choice.message.function_call.arguments);
  
      return response;
    } catch (err) {
      console.error("Error processing order:", err);
      
      // Retornar un objeto vacío bien definido en caso de error
      return { 
        order: {
          date: "",
          status: false,
          name: "",
          phone: "",
          description: "",
          plannedDate: ""
        } 
      };
    }
  };

  determineAppointmentFn = async (
    messages,
    model = "gpt-4-turbo",
    temperature = 0
) => {
    try {
        const completion = await this.openai.chat.completions.create({
            model,
            temperature,
            messages,
            functions: [
                {
                    name: "fn_create_appointment",
                    description: "Extracts necessary information to schedule an appointment.",
                    parameters: {
                        type: "object",
                        properties: {
                            appointment: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "Customer's full name." },
                                    phone: { type: "string", description: "Customer's phone number." },
                                    service: { type: "string", description: "Service the customer wants to book." },
                                    date: { 
                                        type: "string", 
                                        format: "date-time", 
                                        description: "Scheduled date and time for the appointment."
                                    }
                                },
                                required: ["name", "phone", "service", "date"]
                            }
                        },
                        required: ["appointment"]
                    }
                }
            ],
            function_call: { name: "fn_create_appointment" }
        });

        const choice = completion.choices?.[0];
        if (!choice?.message?.function_call?.arguments) {
            throw new Error("No valid response received from AI.");
        }

        const response = JSON.parse(choice.message.function_call.arguments);
        return response;
    } catch (err) {
        console.error("Error processing appointment:", err);
        return { 
            appointment: {
                name: "",
                phone: "",
                service: "",
                date: ""
            } 
        };
    }
};

  
  /**
   * experimental 🟠
   * @param messages
   * @param model
   * @param temperature
   * @returns
   */
  bookChatFn = async (
    messages: ChatCompletionMessageParam[],
    model?: string,
    temperature = 0
  ): Promise<{
    available?: boolean;
    confirm: boolean;
    bookDate: string;
    bestAnswer: string;
  }> => {
    try {
      const completion = await this.openai.chat.completions.create({
        model: model ?? this.model,
        temperature: temperature,
        messages,
        functions: [
          {
            name: "fn_get_book_available",
            description:
              "to obtain the best response for the customer based on the requested date and its availability",
            parameters: {
              type: "object",
              properties: {
                available: {
                  type: "boolean",
                  description:
                    "based on Reserved space you must calculate and tell me if it is possible to schedule based on the date and time that the customer wants",
                },
                bookDate: {
                  type: "string",
                  description:
                    "tentative date and time of booking in YYYYY/MM/DD hh:mm format",
                },
                confirm: {
                  type: "boolean",
                  description:
                    "the seller and the customer confirmed by both parties the appropriate time and date yes or no",
                },
                bestAnswer: {
                  type: "string",
                  description: "seller answer",
                },
              },
              required: ["bestAnswer", "confirm", "bookDate"],
            },
          },
        ],
        function_call: {
          name: "fn_get_book_available",
        },
      });
      // Convert json to object
      const response = JSON.parse(
        completion.choices[0].message.function_call.arguments
      );

      return response;
    } catch (err) {
      console.error(err);
      return {
        bestAnswer: "",
        bookDate: "",
        available: false,
        confirm: false,
      };
    }
  };

  checkConflict = async (
    messages: ChatCompletionMessageParam[],
    model?: string,
    temperature = 0
  ): Promise<{ hasNoConflict: boolean; sellerAnswer: string }> => {
    try {
      const completion = await this.openai.chat.completions.create({
        model: model ?? this.model,
        temperature: temperature,
        messages,
        functions: [
          {
            name: "fn_check_if_exits_conflict",
            description:
              "determine whether there is a conflict with previous reservations on the list",
            parameters: {
              type: "object",
              properties: {
                hasNoConflict: {
                  type: "boolean",
                  description:
                    "is a boolean value indicating if there is no conflict between the date the customer wants and the existing pre-bookings taking into account the last date the customer wants.",
                },
                sellerAnswer: {
                  type: "string",
                  description: "seller answer",
                },
              },
              required: ["hasNoConflict", "sellerAnswer"],
            },
          },
        ],
        function_call: {
          name: "fn_check_if_exits_conflict",
        },
      });
      // Convert json to object
      const response = JSON.parse(
        completion.choices[0].message.function_call.arguments
      );

      return response;
    } catch (err) {
      console.error(err);
      return {
        sellerAnswer: "ERROR",
        hasNoConflict: false,
      };
    }
  };

  /**
   *
   * @param messages
   * @param model
   * @param temperature
   * @returns
   */
  desiredDateFn = async (
    messages: ChatCompletionMessageParam[],
    model?: string,
    temperature = 0
  ): Promise<{ date: string }> => {
    try {
      const completion = await this.openai.chat.completions.create({
        model: model ?? this.model,
        temperature: temperature,
        messages,
        functions: [
          {
            name: "fn_desired_date",
            description:
              "determine the user's desired date in the format  yyyy/MM/dd HH:mm",
            parameters: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description: "yyyy/MM/dd HH:mm",
                },
              },
              required: ["date"],
            },
          },
        ],
        function_call: {
          name: "fn_desired_date",
        },
      });
      // Convert json to object
      const response = JSON.parse(
        completion.choices[0].message.function_call.arguments
      );

      return response;
    } catch (err) {
      console.error(err);
      return {
        date: "",
      };
    }
  };
}

export default AIClass;
