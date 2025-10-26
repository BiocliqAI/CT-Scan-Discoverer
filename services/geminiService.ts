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
        googleMapsLink: {
          type: Type.STRING,
          description: "A Google Maps search URL generated from the center's name and address. e.g., 'https://www.google.com/maps/search/?api=1&query=Center+Name+Address'",
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief, one-sentence summary explaining the evidence found in the text that confirms the presence of a CT scanner.",
        }
      },
      required: ["centerName", "address", "contactDetails", "googleMapsLink", "reasoning"],
    },
};

export const findAndAnalyzeCTScans = async (pincode: string): Promise<ScanCenter[]> => {
  try {
    // Step 1: Use grounding to find information about potential centers.
    const groundingPrompt = `
      Find diagnostic centers, imaging centers, or hospitals near pincode ${pincode}, India, that have a CT scanner. 
      For each one, gather detailed information from Google Search and Maps regarding the services they offer, paying close attention to any mention of "CT Scan", "Computed Tomography", or related imaging services. 
      Also, collect their name, address, and contact details.
    `;

    const groundedResponse = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: groundingPrompt,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });

    const groundedText = groundedResponse.text.trim();
    if (!groundedText) {
      console.log(`No initial information found for pincode ${pincode}.`);
      return [];
    }

    // Step 2: Analyze the grounded text and extract confirmed CT scan centers into a structured JSON format.
    const extractionPrompt = `
      Analyze the following text which contains information about diagnostic centers. Based ONLY on this text, identify and extract details for centers that are definitively confirmed to have a CT (Computed Tomography) scanner.
      
      For each confirmed center, provide the following details:
      1.  **centerName**: The full name of the center.
      2.  **address**: The complete address.
      3.  **contactDetails**: The primary phone number.
      4.  **doctorDetails**: A list of any doctor names mentioned.
      5.  **googleMapsLink**: A Google Maps search URL for the center's name and address (e.g., "https://www.google.com/maps/search/?api=1&query=Center+Name+Address").
      6.  **reasoning**: A concise, one-sentence summary explaining the evidence from the text that indicates a CT scanner is available (e.g., "The center's website explicitly lists 'CT Scan' as a provided service.").

      If the text does not contain enough information to confirm a CT scanner at any location, or if no centers are mentioned, return an empty array.

      Text to analyze:
      ---
      ${groundedText}
      ---
    `;

    const extractionResponse = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: extractionPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    });

    const jsonText = extractionResponse.text.trim();
    if (!jsonText) {
        return [];
    }
    
    // Safely parse the JSON
    try {
        const parsedResponse = JSON.parse(jsonText);
        return parsedResponse as ScanCenter[];
    } catch (parseError) {
        console.error(`Error parsing JSON response for pincode ${pincode}:`, parseError, "JSON Text:", jsonText);
        return [];
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Error discovering scans in pincode ${pincode}:`, errorMessage);
    // Rethrow to be caught in the component
    throw new Error(errorMessage);
  }
};