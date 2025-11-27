import { GoogleGenAI, ChatSession, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

let chatSession: ChatSession | null = null;
let genAI: GoogleGenAI | null = null;

export const initializeChat = async () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found in environment variables.");
    return null;
  }

  try {
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using a model that supports system instructions well
    const chat = genAI.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 1.0, // High temperature for enthusiastic, vibrant persona
      },
    });
    
    chatSession = chat;
    return chat;
  } catch (error) {
    console.error("Failed to initialize Gemini chat:", error);
    return null;
  }
};

export const sendMessage = async (message: string): Promise<string> => {
  if (!chatSession) {
    await initializeChat();
  }

  if (!chatSession) {
     // Fallback if API key is missing or initialization fails
    return "Whoops! My connection to the cloud is a bit fuzzy, but Jesus is right there with you! Try praying 'Jesus, I trust in You' while I reconnect! 🙏";
  }

  try {
    const result = await chatSession.sendMessage({ message });
    return result.text || "I'm searching for the perfect words... but honestly? Just look at Him. He loves you so much! ❤️‍🔥";
  } catch (error) {
    console.error("Error sending message:", error);
    return "Hold up, having a little technical hiccup! But don't let that stop you—He's waiting! 🔥 Try asking me again in a sec!";
  }
};

// --- Audio / TTS Functions ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function convertPCMToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateSpeech = async (text: string): Promise<Uint8Array | null> => {
  if (!process.env.API_KEY) return null;
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // Energetic voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    return decode(base64Audio);

  } catch (error) {
    console.error("Failed to generate speech:", error);
    return null;
  }
};