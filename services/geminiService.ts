import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
// Note: We use process.env.API_KEY as per requirements.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeDiaryEntry = async (title: string, content: string): Promise<{ reflection: string; mood: string }> => {
  try {
    const prompt = `
      Actúa como un terapeuta empático y perspicaz. Analiza la siguiente entrada de diario.
      1. Proporciona una reflexión breve, cálida y constructiva (máximo 2 oraciones).
      2. Identifica el estado de ánimo general en una palabra (ej. Feliz, Ansioso, Esperanzado, Triste, Calmado).
      
      Título: ${title}
      Contenido: ${content}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reflection: { type: Type.STRING },
            mood: { type: Type.STRING }
          },
          required: ["reflection", "mood"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No se generó respuesta.");

    // Clean markdown code blocks if present to ensure JSON.parse works
    const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Error analyzing entry:", error);
    return {
      reflection: "No pudimos conectar con tu asistente de IA en este momento, pero buen trabajo escribiendo hoy.",
      mood: "Neutro"
    };
  }
};