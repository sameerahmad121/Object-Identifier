import { ai } from './googleAI';
import type { Language } from '../App';

const prompts = {
  'it-IT': "Analizza l'intera immagine ma concentrati sull'oggetto all'interno del cerchio bianco. Identifica questo oggetto principale usando la vista circostante per il contesto. Rispondi SOLO con il sostantivo italiano per l'oggetto. Ad esempio: 'Tazza' o 'Libro'. Se non sei sicuro, dì 'Oggetto non identificato'. Sii molto conciso.",
  'en-US': "Analyze the entire image but focus on the object inside the white circle. Identify this primary object using the surrounding view for context. Respond with ONLY the English noun for the object. For example: 'Cup' or 'Book'. If unsure, say 'Object not identified'. Be very concise.",
};


/**
 * Identifies an object in an image and returns its name in the specified language.
 * @param base64ImageData The base64 encoded image data (without the data URL prefix).
 * @param language The target language for the identification.
 * @returns The name of the object in the specified language.
 */
export const identifyObject = async (base64ImageData: string, language: Language): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64ImageData,
      },
    };

    const textPart = {
      text: prompts[language],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text.trim();
    if (!text) {
        throw new Error("AI returned an empty response.");
    }

    // Capitalize the first letter
    return text.charAt(0).toUpperCase() + text.slice(1);

  } catch (error) {
    console.error("Error identifying object with Gemini:", error);
    if (error instanceof Error) {
        return `AI Error: ${error.message}`;
    }
    return "Unknown AI Error";
  }
};