import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with generous limit for conversation TTS payloads
app.use(express.json({ limit: "50mb" }));

// In-memory logs cache for diagnosing published app / API issues
const serverLogs: any[] = [];
function logError(context: string, error: any) {
  const errMsg = error?.message || String(error);
  const logEntry = {
    timestamp: new Date().toISOString(),
    context,
    message: errMsg,
    stack: error?.stack || null,
  };
  serverLogs.unshift(logEntry);
  if (serverLogs.length > 50) {
    serverLogs.pop();
  }
  console.error(`[Server Error] ${context}:`, error);
}

// Endpoint: Retrieve in-memory server logs for troubleshooting
app.get("/api/logs", (req, res) => {
  res.json({
    logs: serverLogs,
    env: {
      hasApiKey: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    }
  });
});

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("Warning: GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper: Convert PCM to WAV
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const buffer = Buffer.alloc(44 + pcmBuffer.length);

  /* RIFF identifier */
  buffer.write("RIFF", 0);
  /* file length */
  buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  /* RIFF type */
  buffer.write("WAVE", 8);
  /* format chunk identifier */
  buffer.write("fmt ", 12);
  /* format chunk length */
  buffer.writeUInt32LE(16, 16);
  /* sample format (1 = PCM) */
  buffer.writeUInt16LE(1, 20);
  /* channel count */
  buffer.writeUInt16LE(numChannels, 22);
  /* sample rate */
  buffer.writeUInt32LE(sampleRate, 24);
  /* byte rate (sample rate * block align) */
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  /* block align (channel count * bytes per sample) */
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  /* bits per sample */
  buffer.writeUInt16LE(bitsPerSample, 34);
  /* data chunk identifier */
  buffer.write("data", 36);
  /* chunk length */
  buffer.writeUInt32LE(pcmBuffer.length, 40);

  pcmBuffer.copy(buffer, 44);
  return buffer;
}

// Helper: Call Gemini models with automatic retries (exponential backoff) and model fallback
async function callGeminiWithRetryAndFallback(
  apiCallFn: (modelName: string) => Promise<any>,
  primaryModel: string = "gemini-3.5-flash",
  fallbackModel: string = "gemini-3.1-flash-lite"
): Promise<any> {
  const modelsToTry = [primaryModel, fallbackModel];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 1000;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Gemini API] Calling model: ${model} (Attempt ${attempt}/${maxAttempts})`);
        return await apiCallFn(model);
      } catch (error: any) {
        lastError = error;
        const status = error?.status || error?.code || error?.statusCode;
        const msg = error?.message || String(error);
        const isTransient =
          status === 503 ||
          status === 429 ||
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("demand") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("exhausted");

        if (isTransient && attempt < maxAttempts) {
          console.warn(`[Gemini API Warning] Attempt ${attempt} for model ${model} failed with ${status || 'transient error'}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        } else {
          console.warn(`[Gemini API Warning] Attempt ${attempt} for model ${model} failed permanently or exhausted. Error:`, msg);
          break; // Try the next fallback model or fail
        }
      }
    }
  }
  throw lastError || new Error("Failed to call Gemini API after retries and fallbacks");
}

// Helper: Call Gemini TTS with automatic retries
async function callGeminiTtsWithRetry(
  apiCallFn: () => Promise<any>
): Promise<any> {
  let lastError: any = null;
  let delay = 1000;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Gemini TTS API] Generating audio (Attempt ${attempt}/${maxAttempts})`);
      return await apiCallFn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.code || error?.statusCode;
      const msg = error?.message || String(error);
      const isTransient =
        status === 503 ||
        status === 429 ||
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("demand") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("exhausted");

      if (isTransient && attempt < maxAttempts) {
        console.warn(`[Gemini TTS API Warning] Attempt ${attempt} failed with ${status || 'transient error'}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
      } else {
        console.warn(`[Gemini TTS API Warning] Attempt ${attempt} failed permanently or exhausted. Error:`, msg);
        break;
      }
    }
  }
  throw lastError || new Error("Failed to call Gemini TTS API after retries");
}


// Endpoint: Generate TEF Canada listening exercise (conversation + questions)
app.post("/api/generate", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured. Please add it to Settings > Secrets.",
      });
    }

    const { selectedTopic, difficulty = "B2", questionType = "mixed", durationSec = 90 } = req.body;
    const topics = ["work", "travel", "housing", "environment", "shopping", "education", "health"];
    const topic = selectedTopic && topics.includes(selectedTopic)
      ? selectedTopic
      : topics[Math.floor(Math.random() * topics.length)];

    const level = ["B1", "B2", "C1"].includes(difficulty) ? difficulty : "B2";
    const qType = ["20-30", "35-40", "mixed"].includes(questionType) ? questionType : "mixed";
    const durationVal = [60, 90, 120].includes(Number(durationSec)) ? Number(durationSec) : 90;

    console.log(`Generating ${level} French TEF Canada exercise for topic: ${topic}, type: ${qType}, duration: ${durationVal}s`);

    let levelDescription = "";
    if (level === "B1") {
      levelDescription = "The language level must be B1 (Intermediate), meaning it uses clear, standard French with common vocabulary, simple to moderately complex structures (present, perfect, imperfect, simple future tenses, basic conjunctions), and concrete topics, suitable for an intermediate learner. The speech should be spoken relatively clearly and moderately paced.";
    } else if (level === "B2") {
      levelDescription = "The language level must be B2 (Upper-Intermediate), meaning it includes idiomatic expressions, complex sentences (gérondifs, subjonctifs, conditional hypotheses), and authentic arguments with subtle nuances, but remains clear.";
    } else {
      levelDescription = "The language level must be C1 (Advanced), meaning it contains fast, highly natural, rich, and sophisticated French on abstract or complex topics, featuring advanced idioms, literary or highly formal structures, subtle implicit details, and challenging nuances.";
    }

    let typeDescription = "";
    if (qType === "20-30") {
      typeDescription = "Mimic the TEF Canada Section B/C (Questions 20-30) style: The exchange or messages are relatively brief, concise, and focused on public situations, short voicemails, public announcements, street polls (sondages), or brief news flashes. The questions should test identifying the communicative context, direct intentions, public settings, or immediate opinions.";
    } else if (qType === "35-40") {
      typeDescription = "Mimic the TEF Canada Section D (Questions 35-40) style: This must be a deep, elaborate, and analytical conversation, interview, or debate between Sophie and Marc. The discussion should focus on detailed arguments, abstract reasoning, and subtle speaker positions. The questions should test complex details, speaker's underlying attitudes/feelings, advanced logical inferences, and high-level figures of speech.";
    } else {
      typeDescription = "A mixed comprehensive style: A solid conversational debate or exchange incorporating both general contextual questions and detailed analytical assessments (global understanding, specific details, attitudes, logical inferences, and idioms).";
    }

    let lengthDescription = "";
    if (durationVal === 60) {
      lengthDescription = "lasting approximately 60 seconds in spoken flow (about 8 to 12 total turn exchanges, around 120 to 160 words total)";
    } else if (durationVal === 120) {
      lengthDescription = "lasting approximately 120 seconds in spoken flow (about 16 to 24 total turn exchanges, around 240 to 320 words total)";
    } else {
      lengthDescription = "lasting approximately 90 seconds in spoken flow (about 12 to 18 total turn exchanges, around 180 to 250 words total)";
    }

    const prompt = `You are an expert TEF Canada (Test d'Évaluation de Français) examiner and curriculum developer.
Generate an authentic French conversation at ${level} level on the topic of "${topic}" matching the requested question category style, designed to resemble questions 20 to 40 of the TEF Canada listening comprehension exam.

CRITICAL INSTRUCTIONS:
- Do NOT explain grammar in any part of the output (especially not in explanations).
- Do NOT teach or adopt a pedagogical/instructive tone.
- Keep all explanations strictly focused on contextual comprehension clues and facts directly stated or implied in the dialogue.

The dialogue MUST be a highly authentic, natural oral French conversation featuring:
1. Hesitations (e.g., "euh", "bah", "enfin", "tu vois", "du coup", "alors").
2. Interruptions (e.g., cut-off thoughts, active conversational overlap, "Non, mais–", "Attends, laisse-moi...").
3. Implicit opinions (speakers' feelings or views should often be conveyed through nuance, irony, or indirect phrasing rather than direct statements).
4. Changes of opinion (a speaker starts with one stance, gets challenged or gets new information, and adjusts their perspective).
5. False assumptions (one speaker assumes something that turns out to be incorrect or misunderstood, which is then corrected).
6. Double negatives (authentic spoken structures like "Je ne dis pas que ce n'est pas...", "Ce n'est pas comme si on n'avait pas...", etc.).
7. Respectful but active disagreement (a genuine debate, tension, or conflicting viewpoints between speakers).
8. Concessions (e.g., "Certes, tu as raison là-dessus, mais...", "Je te l'accorde, néanmoins...", "Soit, mais...").

The dialogue MUST follow these rules:
1. It must be exactly two speakers: Sophie (female voice) and Marc (male voice).
2. The conversation must feel authentic and natural, but articulated, ${lengthDescription}.
3. ${levelDescription}
4. Sophie and Marc must have a structured exchange where they discuss, plan, or debate something related to the topic of ${topic}.
5. ${typeDescription}
6. Provide the dialogue in a "dialogue" JSON array of lines, where each line has "speaker", "voice" ("female" for Sophie, "male" for Marc), and "text" fields.
7. Explicitly set the "duration" field to ${durationVal} in the root of the JSON.

Along with the conversation, generate EXACTLY 5 high-quality TEF Canada listening multiple-choice questions (comprehension orale) in French that reflect this chosen category:
Each question must have options A, B, C, and D, with ONLY ONE correct answer.
Each question must check a different comprehension level appropriate to the ${qType} section:
- Question 1: Global understanding (context, environment, or main goal of the exchange).
- Question 2: Detail comprehension (specific argument or facts mentioned).
- Question 3: Speaker's attitude/opinion/feelings/nuance.
- Question 4: Inference/implicit comprehension (what is implied or can be logically deduced).
- Question 5: Specific ${level} level idiom, vocabulary, or expression used in context.

For each question, provide:
- The question text in French.
- 4 clear options in French (A, B, C, D).
- The correct answer key (A, B, C, or D).
- 'why': A detailed explanation in French of the reasoning/correct answer based strictly on the conversation clues. (Explain the reasoning. Remember: Do NOT explain any grammar or vocabulary rules. Focus purely on comprehension).
- 'trap': A detailed explanation in French of what the candidate may think or get misled by (the common distraction or trap).
- 'keyword': A key connective, transition or word in French from the dialogue that signals the correct meaning (e.g., 'pourtant', 'néanmoins', 'cependant', 'mais'). If none, return 'None'.
- 'grammar': Return 'None' or a brief name of a grammar element used, but keep the focus on reasoning.
- 'vocabulary': A key vocabulary word or expression from the dialogue that helps solve the question, or 'None'.
- 'skillTested': The specific TEF comprehension skill tested. Choose EXACTLY one of: 'Implicit opinion', 'Concession', 'Recommendations', 'Negation', 'Double negatives'.`;

    const response = await callGeminiWithRetryAndFallback(
      (modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "You are a professional TEF Canada test creation system. Return output strictly in JSON according to the requested schema.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: {
                  type: Type.STRING,
                  description: "The topic of the conversation (e.g., Housing, Work, Travel, etc.)"
                },
                duration: {
                  type: Type.INTEGER,
                  description: "The duration of the dialogue in seconds (e.g., 60, 90, 120)."
                },
                dialogue: {
                  type: Type.ARRAY,
                  description: "Dialogue lines in sequential order.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      speaker: {
                        type: Type.STRING,
                        description: "Must be exactly 'Sophie' or 'Marc'."
                      },
                      voice: {
                        type: Type.STRING,
                        description: "Must be exactly 'female' for Sophie and 'male' for Marc."
                      },
                      text: {
                        type: Type.STRING,
                        description: `The spoken text in French, ${level} level.`
                      }
                    },
                    required: ["speaker", "voice", "text"]
                  }
                },
                questions: {
                  type: Type.ARRAY,
                  description: "Exactly 5 TEF Canada multiple-choice questions based on the dialogue.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      questionText: {
                        type: Type.STRING,
                        description: "The question text in French."
                      },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            key: { type: Type.STRING, description: "Must be 'A', 'B', 'C', or 'D'." },
                            text: { type: Type.STRING, description: "The answer option text in French." }
                          },
                          required: ["key", "text"]
                        }
                      },
                      correctAnswer: {
                        type: Type.STRING,
                        description: "The correct option key: 'A', 'B', 'C', or 'D'."
                      },
                      explanation: {
                        type: Type.STRING,
                        description: "Detailed explanation in French of why this answer is correct."
                      },
                      commonTrap: {
                        type: Type.STRING,
                        description: "Description in French of a common trap or distraction in this question (similar to real TEF questions)."
                      },
                      why: {
                        type: Type.STRING,
                        description: "Detailed explanation in French of the reasoning/correct answer. Focus on comprehension and clues."
                      },
                      trap: {
                        type: Type.STRING,
                        description: "Detailed description of what the candidate may think or get misled by (the common trap)."
                      },
                      keyword: {
                        type: Type.STRING,
                        description: "A key connective/transition word in French from the dialogue (e.g., 'pourtant', 'néanmoins') or 'None'."
                      },
                      grammar: {
                        type: Type.STRING,
                        description: "Return 'None' or a brief name of a grammar element used."
                      },
                      vocabulary: {
                        type: Type.STRING,
                        description: "Key vocabulary word or phrase from the dialogue, or 'None'."
                      },
                      skillTested: {
                        type: Type.STRING,
                        description: "The specific TEF comprehension skill tested. Must be exactly one of: 'Implicit opinion', 'Concession', 'Recommendations', 'Negation', 'Double negatives'."
                      }
                    },
                    required: ["id", "questionText", "options", "correctAnswer", "explanation", "commonTrap", "why", "trap", "keyword", "grammar", "vocabulary", "skillTested"]
                  }
                },
                transcript: {
                  type: Type.STRING,
                  description: "The full text transcript of the entire conversation as a single cohesive string, listing speakers and dialogue turns."
                }
              },
              required: ["topic", "duration", "dialogue", "questions", "transcript"]
            }
          }
        }),
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    );

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response received from Gemini.");
    }

    const data = JSON.parse(resultText.trim());
    return res.json(data);
  } catch (error: any) {
    logError("api/generate", error);
    return res.status(500).json({ error: error.message || "Failed to generate TEF conversation and questions." });
  }
});

// Endpoint: AI Coach for personalized session analysis
app.post("/api/coach", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured. Please add it to Settings > Secrets.",
      });
    }

    const { sessionQuestions, sessionScore, skillStats, activeDifficulty } = req.body;

    const prompt = `You are an elite, highly encouraging, and empathetic personal TEF Canada prep coach.
The user just completed a listening comprehension session. Analyze their performance and provide a deeply insightful, personalized, and encouraging review.

Latest Session level: TEF ${activeDifficulty}
Latest Session score: ${sessionScore} / 5 correct answers

Overall competency stats on core TEF hearing skills (historical accuracy):
${JSON.stringify(skillStats, null, 2)}

Detailed breakdown of latest session questions:
${JSON.stringify(sessionQuestions, null, 2)}

CRITICAL RESPONSE GUIDELINES (ACT LIKE A WORLD-CLASS PRIVATE TUTOR):
1. **Tone**: Warm, motivating, focused on active hearing strategies. Address the user directly in French as "tu" (personal, close, coaching relationship).
2. **Language**: Write entirely in French.
3. **Structure**: 
   - Paragraph 1 (Greeting & Performance Vibe): Give immediate reaction to their score of ${sessionScore}/5 at level ${activeDifficulty}. Keep it highly specific, personal, and encouraging.
   - Paragraph 2 (Strengths & Successes): Point out what went exceptionally well. Look at which questions they answered correctly or their strong skill groups.
   - Paragraph 3 (Weakness & Trap Analysis): Unpack where they tripped. Focus on the actual skills of incorrect questions (e.g., changes of opinion, concessions, implicit opinions, or double negatives) in their latest session or historical trends.
   - Paragraph 4 (Actionable Recommendation for Tomorrow): Highlight specifically how the simulator will adapt for them tomorrow (e.g. "Demain, nous ciblerons..."). Write a sentence like: "Demain, ton entraînement inclura plus de dialogues avec des concessions, des doubles négations et des conclusions implicites pour forcer ton oreille à déjouer ces pièges."
5. **Style**: Use clean, elegant markdown formatting (bolding, headers, bullet points). Keep it tight (3-4 paragraphs maximum, around 150-250 words total) so it remains highly readable on the web panel.
6. Avoid general or abstract grammar lectures. Keep feedback tightly coupled with oral comprehension active-listening tricks (e.g., looking out for tone changes, irony, sudden concession conjunctions).

Write the coaching message now:`;

    const response = await callGeminiWithRetryAndFallback(
      (modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "You are the expert personal AI Coach for the TEF Canada Listening Comprehension Simulator, giving highly tailored feedback.",
          },
        }),
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    );

    const feedbackText = response.text;
    return res.json({ feedback: feedbackText });
  } catch (error: any) {
    logError("api/coach", error);
    return res.status(500).json({ error: error.message || "Failed to generate coaching feedback." });
  }
});

// Endpoint: Generate Speech for Conversation
app.post("/api/tts", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured. Please add it to Settings > Secrets.",
      });
    }

    const { dialogue, conversation, randomVoices } = req.body;
    const dialogueLines = dialogue || conversation;
    if (!dialogueLines || !Array.isArray(dialogueLines) || dialogueLines.length === 0) {
      return res.status(400).json({ error: "Missing or invalid dialogue array." });
    }

    console.log(`Generating multi-speaker French dialogue TTS for ${dialogueLines.length} lines. Random voices: ${!!randomVoices}`);

    // Mythological voices selected for clear, distinctly masculine and feminine tones
    const femaleVoices = ["Kore", "Aoede", "Leda", "Callisto", "Dione"];
    // Charon is the most robust, warm, and deep definitive male voice
    const maleVoices = ["Charon"];

    let sophieVoice = "Kore";
    let marcVoice = "Charon"; // Permanent definitive male voice for Marc

    if (randomVoices) {
      sophieVoice = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
    }

    // Normalize speaker labels in the dialogue lines to prevent name-collision errors
    // (e.g., when "Marc" or "Sophie" is mentioned inside the French sentences,
    // speaker-matching algorithms can get confused and switch voices mid-sentence).
    // Mapping them to unique tags 'Speaker_Sophie' and 'Speaker_Marc' prevents this.
    const normalizedLines = dialogueLines.map((line: any) => {
      const isSophie =
        (line.speaker || "").trim().toLowerCase() === "sophie" ||
        (line.voice || "").trim().toLowerCase() === "female";
      return {
        speaker: isSophie ? "Speaker_Sophie" : "Speaker_Marc",
        text: line.text,
      };
    });

    const ttsPrompt = normalizedLines.map((line: any) => `${line.speaker}: ${line.text}`).join("\n");

    const response = await callGeminiTtsWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: "Speaker_Sophie",
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: sophieVoice },
                  },
                },
                {
                  speaker: "Speaker_Marc",
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: marcVoice },
                  },
                },
              ],
            },
          },
        },
      })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini TTS model.");
    }

    // Convert raw 24kHz PCM Little-Endian to a standard WAV format
    const rawPcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = pcmToWav(rawPcmBuffer, 24000, 1, 16);
    const base64Wav = wavBuffer.toString("base64");

    return res.json({
      audioUrl: `data:audio/wav;base64,${base64Wav}`,
    });
  } catch (error: any) {
    logError("api/tts", error);
    return res.status(500).json({ error: error.message || "Failed to generate TTS audio." });
  }
});

// Serve frontend assets and start server
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Listen on host 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
});
