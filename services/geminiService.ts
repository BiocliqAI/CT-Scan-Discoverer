import { GoogleGenAI, Type } from "@google/genai";
import { ScanCenter } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        centerName: {
          type: Type.STRING,
          description: "The full name of the diagnostic center or hospital.",
        },
        address: {
          type: Type.STRING,
          description: "The complete mailing address of the center.",
        },
        contactDetails: {
          type: Type.STRING,
          description: "The primary phone number or contact information.",
        },
        doctorDetails: {
          type: Type.ARRAY,
          description: "A list of names of doctors associated with the center, if any are found.",
          items: {
            type: Type.STRING,
          }
        },
      },
      required: ["centerName", "address", "contactDetails"],
    },
};

export const findAndAnalyzeCTScans = async (pincode: string): Promise<ScanCenter[]> => {
  try {
    const prompt = `
        Find all diagnostic centers, imaging centers, or hospitals in the area of pincode ${pincode}, India that offer CT Scan services.
        Analyze the search results, including names, descriptions, reviews, and website contents, to definitively confirm the presence of a CT (Computed Tomography) scanner.
        For each center you are highly confident has a CT scanner, provide its name, full address, phone number, and a list of any associated doctor names you can find.
        If no centers with confirmed CT scanners are found, return an empty array.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        return [];
    }

    const parsedResponse = JSON.parse(jsonText);
    return parsedResponse as ScanCenter[];

  } catch (error) {
    console.error(`Error discovering scans in pincode ${pincode}:`, error);
    // Return empty array on error to allow process to continue
    return [];
  }
};
