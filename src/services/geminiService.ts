import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function forecastBloodDemand(historicalData: any[], hospitalName: string = "the hospital") {
  if (!historicalData || historicalData.length === 0) {
    return [
      { bloodType: "O+", forecastedQuantity: 10, insight: "Insufficient historical data. Maintaining baseline stock levels is recommended." },
      { bloodType: "A+", forecastedQuantity: 5, insight: "Insufficient historical data. Maintaining baseline stock levels is recommended." }
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert medical logistics analyst for ${hospitalName}. 
      Based on the following historical blood request data (last 20 requests), forecast the demand for each blood type for the next 7 days. 
      Also provide a brief, actionable insight for inventory management for each blood type (e.g., "Increase O- collection due to rising emergency cases").
      
      Historical Data:
      ${JSON.stringify(historicalData)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              bloodType: { type: Type.STRING, description: "The blood type (e.g., A+, O-)" },
              forecastedQuantity: { type: Type.NUMBER, description: "Predicted number of units needed in the next 7 days" },
              insight: { type: Type.STRING, description: "Actionable inventory management advice" }
            },
            required: ["bloodType", "forecastedQuantity", "insight"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Forecasting Error:", error);
    return [];
  }
}
