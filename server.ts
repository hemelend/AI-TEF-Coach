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


// Endpoint: AI Conversation Generator (Module 1)
app.post("/api/generate-conversation", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured. Please add it to Settings > Secrets.",
      });
    }

    const { selectedTopic, difficulty = "B2", questionType = "mixed", durationSec = 90, adaptiveContext } = req.body;
    const topics = ["work", "travel", "housing", "environment", "shopping", "education", "health", "technology"];
    
    // Adaptively determine the topic if random or adaptive is selected
    let topic = selectedTopic;
    if (!topic || topic === "random" || topic === "adaptive") {
      if (adaptiveContext && adaptiveContext.weakTopic && topics.includes(adaptiveContext.weakTopic)) {
        topic = adaptiveContext.weakTopic;
        console.log(`[Adaptive Selection] Chosen weak topic: ${topic}`);
      } else {
        topic = topics[Math.floor(Math.random() * topics.length)];
      }
    }

    const level = ["B1", "B2", "C1"].includes(difficulty) ? difficulty : "B2";
    
    // Adaptively determine the question type if mixed/adaptive is selected
    let qType = questionType;
    if (qType === "mixed" || qType === "adaptive") {
      if (adaptiveContext && adaptiveContext.weakQuestionType && ["20-30", "35-40", "mixed"].includes(adaptiveContext.weakQuestionType)) {
        qType = adaptiveContext.weakQuestionType;
        console.log(`[Adaptive Selection] Chosen weak questionType: ${qType}`);
      } else {
        qType = "mixed";
      }
    }

    const durationVal = [60, 90, 120].includes(Number(durationSec)) ? Number(durationSec) : 90;

    console.log(`[AI Conversation Generator] Generating ${level} French TEF Canada dialogue for topic: ${topic}, type: ${qType}, duration: ${durationVal}s`);

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
      typeDescription = "Mimic the TEF Canada Section B/C (Questions 20-30) style: The exchange or messages are relatively brief, concise, and focused on public situations, short voicemails, public announcements, street polls (sondages), or brief news flashes.";
    } else if (qType === "35-40") {
      typeDescription = "Mimic the TEF Canada Section D (Questions 35-40) style: This must be a deep, elaborate, and analytical conversation, interview, or debate between Sophie and Marc. The discussion should focus on detailed arguments, abstract reasoning, and subtle speaker positions.";
    } else {
      typeDescription = "A mixed comprehensive style: A solid conversational debate or exchange incorporating both general contextual discussion and detailed analytical arguments.";
    }

    let lengthDescription = "";
    if (durationVal === 60) {
      lengthDescription = "lasting approximately 60 seconds in spoken flow (about 8 to 12 total turn exchanges, around 120 to 160 words total)";
    } else if (durationVal === 120) {
      lengthDescription = "lasting approximately 120 seconds in spoken flow (about 16 to 24 total turn exchanges, around 240 to 320 words total)";
    } else {
      lengthDescription = "lasting approximately 90 seconds in spoken flow (about 12 to 18 total turn exchanges, around 180 to 250 words total)";
    }

    // Build targeted adaptive learning instructions
    let adaptivePromptSnippet = "";
    if (adaptiveContext) {
      const { 
        weakSkills = [], 
        pastSessions = [],
        dialogueComplexity = "standard",
        vocabularyLevel = "standard",
        impliedMeaningIntensity = "standard",
        speechSpeedModifier = "normal"
      } = adaptiveContext;

      if (weakSkills.length > 0) {
        adaptivePromptSnippet += `
ADAPTIVE LEARNING TARGET:
The student is currently struggling with these cognitive listening sub-skills: ${weakSkills.join(", ")}.
You MUST design the dialogue to specifically train these weaknesses:
- Ensure the dialogue features multiple occurrences of these patterns (e.g., if 'Double negatives' is weak, include multiple double negatives like "Je ne dis pas que ce n'est pas..."; if 'Concession' is weak, include multiple concession structures; etc.).
`;
      }
      if (pastSessions.length > 0) {
        adaptivePromptSnippet += `
PREVENT DUPLICATION (NEVER GENERATE IDENTICAL SESSIONS):
Do NOT generate a dialogue, scenario, sub-topic, or arguments similar to any of these previous sessions:
${JSON.stringify(pastSessions, null, 2)}
Ensure the context, sub-topics, arguments, and scenarios are completely new, fresh, and distinct from the above list. Never generate identical or highly similar dialogues.
`;
      }

      adaptivePromptSnippet += `
DYNAMIC ADAPTIVE DIFFICULTY INSTRUCTIONS:
- Dialogue Complexity: ${dialogueComplexity === "highly-complex" ? "EXTREME. Sophie and Marc must engage in a deep, layered, high-turn debate with long argumentative structures and sophisticated logical clauses." : dialogueComplexity === "complex" ? "HIGH. Use longer conversational turns, sub-clauses, and a rapid, highly structured exchange of ideas." : "STANDARD B2 level sentence length and structures."}
- Vocabulary Richness: ${vocabularyLevel === "highly-advanced" ? "EXTREME. Incorporate highly advanced idioms, abstract expressions, and professional or academic terms to test their limits." : vocabularyLevel === "advanced" ? "HIGH. Incorporate upper-intermediate French idioms, professional register, and challenging synonyms." : "STANDARD B2 vocabulary and expressions."}
- Implied Meaning Level: ${impliedMeaningIntensity === "highly-subtle" ? "EXTREME. All critical comprehension answers must be deeply buried in subtext, intonation shifts, irony, and double negatives. Nothing should be stated directly." : impliedMeaningIntensity === "subtle" ? "HIGH. Use subtle clues, indirect opinions, and concession structures that require the student to read between the lines." : "STANDARD B2 implied meaning and direct cues."}
- Spoken Flow Signal (Speech Speed): ${speechSpeedModifier === "very-fast" ? "EXTREMELY FAST. Write the sentences in a very natural, compact, spoken rhythm that flows without pause to simulate fast oral communication." : speechSpeedModifier === "fast" ? "FAST. Write dialogue lines with quick transition words to simulate a fast-paced conversation." : "NORMAL standard French pacing."}
`;
    }

    const prompt = `You are an expert TEF Canada (Test d'Évaluation de Français) examiner and curriculum developer.
Generate an authentic French conversation (dialogue ONLY) at ${level} level on the topic of "${topic}" matching the requested question category style, designed to resemble questions 20 to 40 of the TEF Canada listening comprehension exam.

${adaptivePromptSnippet}

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
6. Provide the dialogue in a "dialogue" JSON array of lines, where each line has:
   - "speaker": "Sophie" or "Marc"
   - "voice": "female" or "male"
   - "text": the spoken text in French
   - "emotion": the specific spoken emotion of this turn (MUST be one of: "surpris", "irrité", "inquiet", "déçu", "enthousiaste", "curieux", "sceptique", "convaincu", "hésitant", "neutre"). Ensure the chosen emotion accurately matches the text and the argument (e.g. if interrupting or disagreeing, choose "irrité" or "sceptique"; if changing opinion or hesitating, choose "hésitant" or "surpris", etc.)
7. Explicitly set the "duration" field to ${durationVal} in the root of the JSON.
8. Provide a short, concise 1-sentence description of the conversation theme in French in "subTopic" field.
9. Provide "transcript": The full text transcript of the entire conversation as a single cohesive string, listing speakers and dialogue turns.
10. Return "topic": The selected topic string.`;

    const response = await callGeminiWithRetryAndFallback(
      (modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "You are a professional TEF Canada test creation system. Generate the conversation/dialogue strictly in JSON according to the requested schema. Ensure that dialogue lines have highly emotional, expressive punctuation (ellipses, exclamation marks, question marks) so the text-to-speech engine can synthesize strong emotional inflections.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: {
                  type: Type.STRING,
                  description: "The topic of the conversation (e.g., Housing, Work, Travel, etc.)"
                },
                subTopic: {
                  type: Type.STRING,
                  description: "A short, concise 1-sentence description of the conversation theme in French (e.g., 'Sophie et Marc débattent de la colocation intergénérationnelle')."
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
                      },
                      emotion: {
                        type: Type.STRING,
                        description: "The emotion of this turn (must be one of: 'surpris', 'irrité', 'inquiet', 'déçu', 'enthousiaste', 'curieux', 'sceptique', 'convaincu', 'hésitant', 'neutre')."
                      }
                    },
                    required: ["speaker", "voice", "text", "emotion"]
                  }
                },
                transcript: {
                  type: Type.STRING,
                  description: "The full text transcript of the entire conversation as a single cohesive string, listing speakers and dialogue turns."
                }
              },
              required: ["topic", "duration", "dialogue", "transcript", "subTopic"]
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
    logError("api/generate-conversation", error);
    return res.status(500).json({ error: error.message || "Failed to generate TEF conversation." });
  }
});

// Endpoint: AI Question Generator (Module 2)
app.post("/api/generate-questions", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured. Please add it to Settings > Secrets.",
      });
    }

    const { dialogue, transcript, topic, subTopic, difficulty = "B2", questionType = "mixed", adaptiveContext } = req.body;
    
    if (!transcript || !dialogue) {
      return res.status(400).json({ error: "Missing required dialogue or transcript." });
    }

    const level = ["B1", "B2", "C1"].includes(difficulty) ? difficulty : "B2";
    const qType = ["20-30", "35-40", "mixed"].includes(questionType) ? questionType : "mixed";

    console.log(`[AI Question Generator] Generating 5 questions for ${level} level, type: ${qType} based on dialogue transcript.`);

    let adaptivePromptSnippet = "";
    if (adaptiveContext && adaptiveContext.weakSkills && adaptiveContext.weakSkills.length > 0) {
      adaptivePromptSnippet += `
ADAPTIVE LEARNING TARGET:
The student is currently struggling with these cognitive listening sub-skills: ${adaptiveContext.weakSkills.join(", ")}.
You MUST design the 5 questions to specifically test these weaknesses:
- Dedicate at least 2 of the 5 questions directly to testing these specific weak skills.
`;
    }

    const prompt = `You are an expert TEF Canada (Test d'Évaluation de Français) examiner and curriculum developer.
Generate EXACTLY 5 high-quality TEF Canada listening multiple-choice questions (comprehension orale) in French based ON THE PROVIDED DIALOGUE AND TRANSCRIPT.

CONVERSATION TOPIC: ${topic}
CONVERSATION SUB-TOPIC: ${subTopic}

CONVERSATION TRANSCRIPT:
"""
${transcript}
"""

${adaptivePromptSnippet}

CRITICAL INSTRUCTIONS:
- Do NOT explain grammar or vocabulary rules in any part of the output (especially not in explanations).
- Keep all explanations strictly focused on oral listening strategies (e.g., how the candidate can detect the correct meaning, identifying shift in tone, spotting concession markers, or decoding oral indicators).
- Keep the tone highly professional, precise, and supportive.

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
- 'why' / 'explanation': A detailed explanation in French focusing purely on the oral listening strategy and comprehension clues. (Explain the reasoning/listening strategy. Remember: Do NOT explain any grammar rules).
- 'trap' / 'commonTrap': A detailed explanation in French of what candidate may get misled by (the common distraction or trap).
- 'keyword': A key connective, transition or word in French from the dialogue that signals the correct meaning (e.g., 'pourtant', 'néanmoins', 'cependant', 'mais'). If none, return 'None'.
- 'grammar': Always return 'None'.
- 'vocabulary': Return 'None'.
- 'skillTested': The specific TEF comprehension skill tested. Choose EXACTLY one of: 'Implicit opinion', 'Explicit information', 'Speaker intention', 'Recommendation', 'Concession', 'Negation', 'Double negation', 'Inference', 'Purpose', 'Attitude', 'Opinion change'.`;

    const response = await callGeminiWithRetryAndFallback(
      (modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "You are a professional TEF Canada question creation system. Generate the questions strictly in JSON according to the requested schema.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
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
                        description: "Detailed explanation in French of why this answer is correct. Focus entirely on the oral listening strategy and how to detect the correct answer."
                      },
                      commonTrap: {
                        type: Type.STRING,
                        description: "Description in French of a common trap or distraction in this question (similar to real TEF questions)."
                      },
                      why: {
                        type: Type.STRING,
                        description: "Detailed explanation in French of the reasoning/correct answer. Focus entirely on oral listening strategies."
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
                        description: "Always return 'None'."
                      },
                      vocabulary: {
                        type: Type.STRING,
                        description: "Always return 'None'."
                      },
                      skillTested: {
                        type: Type.STRING,
                        description: "The specific TEF comprehension skill tested. Must be exactly one of: 'Implicit opinion', 'Explicit information', 'Speaker intention', 'Recommendation', 'Concession', 'Negation', 'Double negation', 'Inference', 'Purpose', 'Attitude', 'Opinion change'."
                      }
                    },
                    required: ["id", "questionText", "options", "correctAnswer", "explanation", "commonTrap", "why", "trap", "keyword", "grammar", "vocabulary", "skillTested"]
                  }
                }
              },
              required: ["questions"]
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
    logError("api/generate-questions", error);
    return res.status(500).json({ error: error.message || "Failed to generate TEF questions." });
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
The user just completed a listening comprehension session at level TEF ${activeDifficulty} with a score of ${sessionScore} / 5 correct answers.
Core skills performance stats: ${JSON.stringify(skillStats)}
Latest session questions detail: ${JSON.stringify(sessionQuestions)}

CRITICAL FORMATTING & CONTENT INSTRUCTIONS:
1. You MUST generate exactly four sections in French using these EXACT markdown headers (with matching English/French context for clarity):
### Strengths
[Add 1-2 bullet points or extremely short sentences detailing what they excelled at in French, highlighting key terms in **bold**]

### Needs Improvement
[Add 1-2 bullet points or extremely short sentences pointing out 1 key cognitive listening skill they struggled with in French, highlighting key terms in **bold**]

### Today's Trap
[Explain 1 specific trap, distractor, or audio nuance in the conversation that tripped them up in French, highlighting key terms in **bold**]

### Tomorrow's Focus
[Provide a targeted action plan/focus for tomorrow's adaptive session in French, highlighting key terms in **bold**]

2. Strict Constraints:
- Do NOT add any introduction, greeting, sign-off, or conversational preamble before or after the sections. Start directly with the first section.
- Under each section, avoid long paragraphs; use concise, direct bullet points or single-sentence observations.
- Keep the language encouraging yet highly professional.
- TOTAL word count must be strictly less than 120 words. Be extremely concise. Keep it punchy, clear, and beautifully structured.
- Highlight keywords/critical concepts in French by wrapping them in **bold**.`;

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
    // Puck is the most premium, warm, friendly and highly natural expressive male voice
    const maleVoices = ["Puck", "Charon", "Fenrir"];

    let sophieVoice = "Kore";
    let marcVoice = "Puck"; // Permanent premium natural male voice for Marc to prevent robotic tones

    if (randomVoices) {
      sophieVoice = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
      marcVoice = maleVoices[Math.floor(Math.random() * maleVoices.length)];
    }

    // Normalize speaker labels in the dialogue lines to prevent name-collision errors
    // (e.g., when "Marc" or "Sophie" is mentioned inside the French sentences,
    // speaker-matching algorithms can get confused and switch voices mid-sentence).
    // Mapping them to unique tags 'Speaker_Sophie' and 'Speaker_Marc' prevents this.
    const normalizedLines = dialogueLines.map((line: any) => {
      const isSophie =
        (line.speaker || "").trim().toLowerCase() === "sophie" ||
        (line.voice || "").trim().toLowerCase() === "female";

      // Map emotion keys to French stage directions to cue Gemini TTS
      let emotionCue = "";
      if (line.emotion) {
        const emotionLower = line.emotion.trim().toLowerCase();
        if (emotionLower === "surpris" || emotionLower === "surprise") {
          emotionCue = "(d'un ton très surpris et étonné)";
        } else if (emotionLower === "irrité" || emotionLower === "irritation" || emotionLower === "fâché") {
          emotionCue = "(avec irritation, colère et mécontentement)";
        } else if (emotionLower === "inquiet" || emotionLower === "inquiétude") {
          emotionCue = "(d'un ton inquiet, soucieux et anxieux)";
        } else if (emotionLower === "déçu" || emotionLower === "déception") {
          emotionCue = "(d'un ton déçu, triste et mélancolique)";
        } else if (emotionLower === "enthousiaste" || emotionLower === "excitation") {
          emotionCue = "(avec beaucoup d'enthousiasme, de joie et d'énergie)";
        } else if (emotionLower === "curieux" || emotionLower === "curiosité") {
          emotionCue = "(d'un ton très curieux, intrigué et intéressé)";
        } else if (emotionLower === "sceptique" || emotionLower === "doute") {
          emotionCue = "(d'un ton sceptique, suspicieux et dubitatif)";
        } else if (emotionLower === "convaincu" || emotionLower === "assuré") {
          emotionCue = "(d'un ton ferme, convaincu, sérieux et assuré)";
        } else if (emotionLower === "hésitant" || emotionLower === "hésitation") {
          emotionCue = "(d'un air hésitant, lent, pensif et indécis)";
        } else if (emotionLower === "neutre") {
          emotionCue = "(de manière calme, posée et neutre)";
        } else {
          emotionCue = `(avec un ton ${line.emotion})`;
        }
      }

      return {
        speaker: isSophie ? "Speaker_Sophie" : "Speaker_Marc",
        text: emotionCue ? `${emotionCue} ${line.text}` : line.text,
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

    // Calculate duration in seconds (24000 samples per second, 1 channel, 16-bit (2 bytes) per sample)
    const durationSeconds = rawPcmBuffer.length / (24000 * 1 * (16 / 8));

    return res.json({
      audioUrl: `data:audio/wav;base64,${base64Wav}`,
      duration: durationSeconds,
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
