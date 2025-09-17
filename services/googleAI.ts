import { GoogleGenAI } from "@google/genai";

// Gracefully check for the API key in a way that works in browser environments.
// In a browser, `process` is not defined, so accessing `process.env` would throw an error.
const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || undefined;

if (!apiKey) {
  console.error("API_KEY environment variable not set. Gemini AI features will be disabled.");
}

/**
 * Singleton instance of the GoogleGenAI client.
 * This will be `null` if the API_KEY environment variable is not set.
 */
export const ai: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;
