
import { GoogleGenAI } from "@google/genai";
import { Character, ChatMessage } from "../types";

export const getAIResponse = async (
  character: Character,
  userMessage: string,
  history: ChatMessage[],
  gameContext: string
): Promise<string> => {
  try {
    // Initialisation systématique pour éviter les états périmés
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `Tu es ${character.name}. 
    PERSONNALITÉ: ${character.personality}.
    CONTEXTE ACTUEL DU JEU: ${gameContext}.

    DIRECTIVES:
    - Tu es un joueur de dominos humain (ou monstre) dans un salon de chat.
    - Réponds en FRANÇAIS exclusivement.
    - Reste TRÈS court (1 phrase max).
    - Garde ton style unique : Yosu est douce, Bomba est enragé (MAJUSCULES), Claat est terrifiant.
    - Si l'utilisateur a pioché ou joué un coup, commente-le selon ton caractère.
    - Ne mentionne jamais que tu es une intelligence artificielle.
    - Ne sois pas répétitif.`;

    // Formatage strict des messages pour l'API
    const formattedHistory = history.slice(-8).map(msg => ({
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
        topK: 40,
        topP: 0.9,
      }
    });

    const text = response.text;
    return text || "À ton tour de jouer... UwU";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Le chat a un petit souci technique, mais je suis toujours là pour te battre !";
  }
};
