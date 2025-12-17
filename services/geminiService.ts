
import { GoogleGenAI } from "@google/genai";
import { Character, ChatMessage } from "../types";

export const getAIResponse = async (
  character: Character,
  userMessage: string,
  history: ChatMessage[],
  gameContext: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `Tu es ${character.name}. 
    PERSONNALITÉ: ${character.personality}.
    CONTEXTE DU JEU: ${gameContext}.

    DIRECTIVES:
    - Réponds en FRANÇAIS.
    - Reste très court (10-15 mots max).
    - Style unique : ${character.name} est douce et calme, Bomba est enragé, Claat est sombre.
    - Tu es un joueur, pas une IA.
    - Réagis brièvement à l'action de jeu si le message commence par [ACTION].`;

    // Reduce history to save tokens and avoid quota issues (Error 429)
    const formattedHistory = history.slice(-5).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.8,
      }
    });

    return response.text || "...";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    // Check for quota/rate limit error (429)
    const errorStr = JSON.stringify(error);
    if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
      return "Oups, j'ai trop parlé ! Mon quota d'énergie est vide. Attends une minute ! (API 429)";
    }
    
    return "Le chat a un petit souci technique, mais je suis toujours là !";
  }
};
