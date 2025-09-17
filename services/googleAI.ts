import { GoogleGenAI } from "@google/genai";

// Ensure the environment variable is checked once.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

/**
 * Singleton instance of the GoogleGenAI client.
 */
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
