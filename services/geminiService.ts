import { GoogleGenAI, Type } from "@google/genai";
import { ScanCenter } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export type GeminiCallStage = 'grounding' | 'extraction';

export interface GeminiCallTelemetry {
    id: string;
    pincode: string;
    stage: GeminiCallStage;
    status: 'success' | 'error';
    startedAt: string;
    durationMs: number;
    promptChars: number;
    responseChars?: number;
    errorMessage?: string;
}

const geminiTelemetry: GeminiCallTelemetry[] = [];

const getPerfTime = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

const createTelemetryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const pushTelemetry = (entry: GeminiCallTelemetry) => {
    geminiTelemetry.push(entry);
    const { stage, status, pincode, durationMs, promptChars, responseChars, errorMessage } = entry;
    const metaParts = [`prompt ${promptChars}`];
    if (typeof responseChars === 'number') {
        metaParts.push(`response ${responseChars}`);
    }
    const baseMessage = `[Gemini][${stage}] ${status.toUpperCase()} for ${pincode} in ${durationMs.toFixed(1)}ms (${metaParts.join(', ')})`;
    if (status === 'error') {
        console.warn(`${baseMessage}${errorMessage ? ` :: ${errorMessage}` : ''}`);
    } else {
        console.info(baseMessage);
    }
};

export const getGeminiTelemetry = () => geminiTelemetry.slice();

export const clearGeminiTelemetry = () => {
    geminiTelemetry.length = 0;
};

const runWithTelemetry = async <T>(
    stage: GeminiCallStage,
    pincode: string,
    promptChars: number,
    executor: () => Promise<T>,
    getResponseChars?: (result: T) => number | undefined
): Promise<T> => {
    const startedAt = new Date().toISOString();
    const startTime = getPerfTime();

    try {
        const result = await executor();
        const durationMs = getPerfTime() - startTime;
        const responseChars = getResponseChars ? getResponseChars(result) : undefined;

        pushTelemetry({
            id: createTelemetryId(),
            pincode,
            stage,
            status: 'success',
            startedAt,
            durationMs,
            promptChars,
            responseChars,
        });

        return result;
    } catch (error) {
        const durationMs = getPerfTime() - startTime;
        pushTelemetry({
            id: createTelemetryId(),
            pincode,
            stage,
            status: 'error',
            startedAt,
            durationMs,
            promptChars,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
};

const getResponseTextLength = (payload: { text?: string } | undefined) =>
    payload && typeof payload.text === 'string' ? payload.text.length : undefined;

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
          description: "The complete mailing address of the center, including the 6-digit pincode.",
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

const createAddressFingerprint = (address: string): string => {
    return address.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const findAndAnalyzeCTScans = async (pincode: string, existingResults: ScanCenter[] = []): Promise<ScanCenter[]> => {
  try {
    const groundingPrompt = `
      Find diagnostic centers, imaging centers, or hospitals near pincode ${pincode}, India, that have a CT scanner. 
      For each one, gather detailed information from Google Search and Maps regarding the services they offer, paying close attention to any mention of "CT Scan", "Computed Tomography", or related imaging services. 
      Also, collect their name, address, and contact details.
    `;

    const groundedResponse = await runWithTelemetry(
        'grounding',
        pincode,
        groundingPrompt.length,
        () => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: groundingPrompt,
            config: {
                tools: [{ googleSearch: {} }, { googleMaps: {} }],
            },
        }),
        getResponseTextLength
    );

    const groundedTextRaw = typeof groundedResponse.text === 'string' ? groundedResponse.text : '';
    const groundedText = groundedTextRaw.trim();
    if (!groundedText) {
      console.log(`No initial information found for pincode ${pincode}.`);
      return [];
    }

    const extractionPrompt = `
      Analyze the following text which contains information about diagnostic centers. Based ONLY on this text, identify and extract details for centers that are definitively confirmed to have a CT (Computed Tomography) scanner.
      
      For each confirmed center, provide the following details:
      1.  **centerName**: The full name of the center.
      2.  **address**: The complete address, making sure to include the 6-digit pincode.
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

    const extractionResponse = await runWithTelemetry(
        'extraction',
        pincode,
        extractionPrompt.length,
        () => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: extractionPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        }),
        getResponseTextLength
    );

    const jsonTextRaw = typeof extractionResponse.text === 'string' ? extractionResponse.text : '';
    const jsonText = jsonTextRaw.trim();
    if (!jsonText) {
        return [];
    }
    
    try {
        const parsedResponse = JSON.parse(jsonText) as ScanCenter[];
        
        // --- Filtering Logic ---
        const existingAddressFingerprints = new Set(existingResults.map(center => createAddressFingerprint(center.address)));

        const filteredResults = parsedResponse.filter(newCenter => {
            // Address de-duplication only; allow cross-pincode matches for now.
            const newFingerprint = createAddressFingerprint(newCenter.address);
            if (existingAddressFingerprints.has(newFingerprint)) {
                console.log(`Dropping duplicate center "${newCenter.centerName}" based on address.`);
                return false;
            }
            
            existingAddressFingerprints.add(newFingerprint); // Add to set to de-dupe within the same API response
            return true;
        });

        return filteredResults;

    } catch (parseError) {
        console.error(`Error parsing JSON response for pincode ${pincode}:`, parseError, "JSON Text:", jsonText);
        return [];
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Error discovering scans in pincode ${pincode}:`, errorMessage);
    throw new Error(errorMessage);
  }
};
