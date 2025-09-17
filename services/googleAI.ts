import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error("API_KEY environment variable not set. This is required for the application to function.");
}

/**
 * Singleton instance of the GoogleGenAI client.
 * Assumes API_KEY is available as an environment variable.
 */
export const ai = new GoogleGenAI({ apiKey });
