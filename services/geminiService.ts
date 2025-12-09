import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BillData, UpdateResponse } from "../types";

// Initialize Gemini Client
// WARNING: In a production app, never expose API keys on the client side.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-pro-preview';

// Schema for parsing the initial receipt
const receiptSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "List of items purchased",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID for the item (e.g. item_1)" },
          description: { type: Type.STRING, description: "Name or description of the item" },
          price: { type: Type.NUMBER, description: "Price of the individual item" },
          assignedTo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Leave empty initially. Used for assigning people."
          }
        },
        required: ["id", "description", "price", "assignedTo"]
      }
    },
    subtotal: { type: Type.NUMBER, description: "Subtotal before tax/tip" },
    tax: { type: Type.NUMBER, description: "Total tax amount" },
    tip: { type: Type.NUMBER, description: "Total tip amount (if present on receipt, else 0)" },
    total: { type: Type.NUMBER, description: "Grand total" },
    currency: { type: Type.STRING, description: "Currency symbol (e.g. $, €)" }
  },
  required: ["items", "subtotal", "tax", "tip", "total", "currency"]
};

// Schema for the chat update response
const updateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    updatedBill: receiptSchema,
    responseText: { type: Type.STRING, description: "A conversational response confirming the action." }
  },
  required: ["updatedBill", "responseText"]
};

export const parseReceiptImage = async (file: File): Promise<BillData> => {
  // Convert file to base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data
          }
        },
        {
          text: "Analyze this receipt. Extract all items, prices, tax, and tip. Return a JSON structure conforming to the schema."
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: receiptSchema,
      systemInstruction: "You are an expert receipt parser. Be precise with prices. If tip is not visible, set to 0."
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as BillData;
};

export const processChatCommand = async (
  currentBill: BillData,
  userMessage: string
): Promise<UpdateResponse> => {
  const prompt = `
    Current Bill State:
    ${JSON.stringify(currentBill, null, 2)}

    User Command: "${userMessage}"

    Instructions:
    1. Interpret the user's command to assign items to people (e.g., "John had the burger").
    2. Update the 'assignedTo' array for the relevant items in the bill state.
    3. If multiple people shared an item, add all their names to 'assignedTo'.
    4. Return the COMPLETE updated bill object and a short, friendly confirmation message.
    5. Do NOT change item prices or descriptions unless explicitly asked to correct a mistake.
    6. Normalize names (e.g., "Dave" and "David" should be treated as the same person if context implies, but prefer the user's latest usage).
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: updateSchema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as UpdateResponse;
};