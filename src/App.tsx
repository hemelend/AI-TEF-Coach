import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart as RechartsBarChart,
  Bar,
  Cell as RechartsCell
} from "recharts";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Sparkles,
  ChevronRight,
  GraduationCap,
  Eye,
  EyeOff,
  Trash2,
  ListRestart,
  Volume1,
  BookmarkCheck,
  Check,
  Languages,
  Activity,
  Award,
  Lock,
  ChevronLeft,
  Clock,
  Calendar,
  Target,
  Compass,
  Hourglass,
  Home,
  Cpu,
  History,
  Brain,
  TrendingUp,
  LineChart,
} from "lucide-react";

// Types
interface DialogueLine {
  speaker: "Sophie" | "Marc";
  voice: "female" | "male";
  text: string;
  emotion?: string;
}

interface QuestionOption {
  key: "A" | "B" | "C" | "D";
  text: string;
}

interface TEFQuestion {
  id: number;
  questionText: string;
  options: QuestionOption[];
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
  commonTrap: string;
  why?: string;
  trap?: string;
  keyword?: string;
  grammar?: string;
  vocabulary?: string;
  skillTested?: string;
}

interface TEFExercise {
  topic: string;
  subTopic?: string;
  duration: number;
  dialogue: DialogueLine[];
  questions: TEFQuestion[];
  transcript?: string;
}

interface AdaptiveHistoryEntry {
  id: string;
  timestamp: string;
  topic: string;
  difficulty: "B1" | "B2" | "C1";
  questionType: "20-30" | "35-40" | "mixed";
  score: number;
  total: number;
  elapsedTime: number;
  weakSkills: string[];
  dialogueTopicSummary?: string;
  exercise?: TEFExercise;
  selectedAnswers?: { [key: string]: "A" | "B" | "C" | "D" };
  estimatedTefScore?: number;
  coachFeedback?: string | null;
}

interface MasterySnapshot {
  timestamp: string;
  sessionName: string;
  overallAccuracy: number;
  tefScore: number;
}

interface TopicStat {
  correct: number;
  total: number;
}

interface TopicStats {
  [key: string]: TopicStat;
}

const TOPICS = [
  { id: "work", label: "Work", icon: "💼" },
  { id: "housing", label: "Housing", icon: "🏠" },
  { id: "shopping", label: "Shopping", icon: "🛒" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "health", label: "Health", icon: "🏥" },
  { id: "environment", label: "Environment", icon: "🌱" },
];

const LOADING_TIPS = [
  "Conseil TEF : Entraînez-vous à repérer les mots de liaison comme 'pourtant', 'cependant' ou 'en fait' qui modifient souvent le sens de la phrase.",
  "Conseil TEF : Les distracteurs utilisent souvent des homophones ou des mots proches phonétiquement mais avec un sens totalement différent.",
  "Conseil TEF : Ne choisissez pas une option simplement parce qu'elle contient un mot entendu. Le TEF piège souvent les écoutes trop littérales.",
  "Conseil TEF : Concentrez-vous sur l'attitude du locuteur. Sophie exprime-t-elle un doute, un regret, ou un enthousiasme ?",
  "Conseil TEF : L'épreuve de compréhension orale demande une concentration maximale. Fermez les yeux pendant la première écoute.",
  "Conseil TEF : Le niveau B2 implique la compréhension d'arguments nuancés et d'hypothèses au conditionnel ou subjonctif.",
];

// Simple bold tag parser: **text** -> <strong>text</strong>
const parseBoldText = (text: string) => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i} className="font-bold text-white">{part}</strong>;
    }
    return part;
  });
};

// Simple dynamic Markdown parser to format AI Coach feedback beautifully
const renderMarkdown = (text: string) => {
  if (!text) return null;
  
  const lines = text.split("\n");
  
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} className="h-3" />;
    }
    
    // Check for headers
    if (trimmed.startsWith("###")) {
      return (
        <h3 key={idx} className="text-sm font-extrabold text-indigo-300 mt-4 mb-2 flex items-center gap-1.5 font-display">
          {trimmed.replace(/^###\s*/, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("####")) {
      return (
        <h4 key={idx} className="text-xs font-black uppercase tracking-wider text-pink-400 mt-4 mb-2 font-display">
          {trimmed.replace(/^####\s*/, "")}
        </h4>
      );
    }
    if (trimmed.startsWith("##")) {
      return (
        <h2 key={idx} className="text-base font-extrabold text-slate-100 mt-5 mb-2 font-display">
          {trimmed.replace(/^##\s*/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("#")) {
      return (
        <h1 key={idx} className="text-lg font-black text-slate-100 mt-6 mb-3 font-display">
          {trimmed.replace(/^#\s*/, "")}
        </h1>
      );
    }
    
    // Check for list items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const rawContent = trimmed.replace(/^[-*]\s*/, "");
      return (
        <div key={idx} className="flex items-start gap-2.5 my-2.5 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 animate-pulse" />
          <p className="text-xs text-slate-300 leading-relaxed flex-1">
            {parseBoldText(rawContent)}
          </p>
        </div>
      );
    }
    
    // Normal paragraph
    return (
      <p key={idx} className="text-xs md:text-sm text-slate-300 leading-relaxed my-2">
        {parseBoldText(trimmed)}
      </p>
    );
  });
};

const normalizeSkill = (skill: string, index: number): string => {
  const s = (skill || "").trim().toLowerCase();
  
  if (s.includes("double neg") || s.includes("double nég")) return "Double negation";
  if (s.includes("opinion change") || s.includes("changement d'opinion") || s.includes("change of opinion")) return "Opinion change";
  if (s.includes("implicit opinion") || s.includes("opinion implicite")) return "Implicit opinion";
  if (s.includes("explicit") || s.includes("explicite")) return "Explicit information";
  if (s.includes("speaker intention") || s.includes("intention du locuteur") || s.includes("intention de l'orateur") || s.includes("speaker's intention")) return "Speaker intention";
  if (s.includes("recommend") || s.includes("conseil")) return "Recommendation";
  if (s.includes("concession") || s.includes("restriction")) return "Concession";
  if (s.includes("negation") || s.includes("négation")) return "Negation";
  if (s.includes("inference") || s.includes("inférence") || s.includes("implicit comprehension")) return "Inference";
  if (s.includes("purpose") || s.includes("but") || s.includes("objectif")) return "Purpose";
  if (s.includes("attitude") || s.includes("sentiment") || s.includes("feeling")) return "Attitude";

  const skillsList = [
    "Implicit opinion",
    "Explicit information",
    "Speaker intention",
    "Recommendation",
    "Concession",
    "Negation",
    "Double negation",
    "Inference",
    "Purpose",
    "Attitude",
    "Opinion change"
  ];
  return skillsList[index % skillsList.length];
};

interface ImprovementChartProps {
  data: MasterySnapshot[];
}

function ImprovementChart({ data }: ImprovementChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100">
        <p className="text-xs text-slate-400">Aucune donnée historique à afficher.</p>
      </div>
    );
  }

  // Svg layout bounds
  const width = 500;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Let's plot overallAccuracy (0 to 100)
  // X coordinates
  const points = data.map((d, i) => {
    const x = paddingLeft + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
    // scale y from 0 to 100
    const y = paddingTop + chartHeight - (d.overallAccuracy / 100) * chartHeight;
    return { x, y, ...d };
  });

  // Build the line path d
  let linePath = "";
  let areaPath = "";
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  // Hover state tooltip helper
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="space-y-4">
      {/* Tooltip Header / Selected Point Detail */}
      <div className="h-12 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
        {hoveredPoint ? (
          <div className="flex justify-between items-center w-full">
            <div className="text-left">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-display leading-none">
                {hoveredPoint.sessionName}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(hoveredPoint.timestamp).toLocaleDateString("fr-FR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>
            <div className="flex gap-4 items-center">
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 block leading-none">PRÉCISION</span>
                <span className="text-sm font-black text-indigo-600 font-display">{hoveredPoint.overallAccuracy}%</span>
              </div>
              <div className="text-right border-l border-slate-200 pl-4">
                <span className="text-[9px] font-bold text-slate-400 block leading-none">EST. TEF</span>
                <span className="text-sm font-black text-indigo-600 font-display">{hoveredPoint.tefScore} <span className="text-[10px] font-bold text-slate-400">/699</span></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-indigo-500 font-bold text-xs">📈</span>
            <span className="text-xs text-slate-500 font-medium">Survolez les points pour voir le détail de votre progression.</span>
          </div>
        )}
      </div>

      {/* SVG Chart Container */}
      <div className="relative bg-slate-50/30 rounded-xl border border-slate-100 p-2 overflow-visible">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible" id="improvement-svg-chart">
          {/* Definitions for Gradients */}
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines (Y-axis: 40%, 60%, 80%, 100%) */}
          {[40, 60, 80, 100].map((val) => {
            const y = paddingTop + chartHeight - (val / 100) * chartHeight;
            return (
              <g key={val} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  className="font-mono text-[9px] font-extrabold"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* X Axis label placeholders */}
          {points.length > 0 && (
            <g className="opacity-60">
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight}
                x2={width - paddingRight}
                y2={paddingTop + chartHeight}
                stroke="#cbd5e1"
                strokeWidth="1.5"
              />
              {points.map((p, idx) => {
                // Show label only for first, middle, and last points to avoid crowding
                const showLabel = idx === 0 || idx === points.length - 1 || (points.length > 4 && idx === Math.floor(points.length / 2));
                if (!showLabel) return null;
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={paddingTop + chartHeight + 14}
                    textAnchor="middle"
                    fill="#64748b"
                    className="font-display font-black text-[8px] uppercase tracking-wider"
                  >
                    S{idx + 1}
                  </text>
                );
              })}
            </g>
          )}

          {/* Area Path */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#chartGradient)"
            />
          )}

          {/* Line Path */}
          {linePath && (
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              d={linePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Point Dots with Hover Area */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g key={idx}>
                {/* Visual Circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? "#ffffff" : "#4f46e5"}
                  stroke="#4f46e5"
                  strokeWidth={isHovered ? 3.5 : 2}
                  className="transition-all duration-150"
                />
                
                {/* Large Transparent Pointer Event Target */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Helper to format skill names beautifully
const formatSkillDisplay = (skill: string) => {
  const mappings: Record<string, string> = {
    "Implicit opinion": "Implicit Opinions",
    "Explicit information": "Explicit Information",
    "Speaker intention": "Speaker Intentions",
    "Recommendation": "Recommendations",
    "Concession": "Concessions",
    "Negation": "Negations",
    "Double negation": "Double Negations",
    "Inference": "Inferences",
    "Purpose": "Purpose Detection",
    "Attitude": "Attitude & Emotion",
    "Opinion change": "Opinion Shifts",
  };
  return mappings[skill] || skill;
};

// Deterministic daily mission generator based on current date
const getDailyMission = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Simple LCG seeded by the date hash to generate consistent daily parameters
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const seed = Math.abs(hash);
  const lcg = (s: number) => {
    let current = s;
    return () => {
      current = (current * 1664525 + 1013904223) % 4294967296;
      return current / 4294967296;
    };
  };

  const nextRand = lcg(seed);

  // 1. Topic
  const topicsList = ["work", "travel", "housing", "environment", "shopping", "education", "health", "technology"];
  const topicId = topicsList[Math.floor(nextRand() * topicsList.length)];
  const topicLabel = topicId.charAt(0).toUpperCase() + topicId.slice(1);

  // 2. Question type: "20-30" or "35-40"
  const qType = nextRand() < 0.5 ? "20-30" : "35-40";

  // 3. Duration: 60, 90, or 120 seconds
  const durations = [60, 90, 120];
  const durationSec = durations[Math.floor(nextRand() * durations.length)];

  // 4. Target Skill
  const skillsList = [
    "Implicit opinion",
    "Explicit information",
    "Speaker intention",
    "Recommendation",
    "Concession",
    "Negation",
    "Double negation",
    "Inference",
    "Purpose",
    "Attitude",
    "Opinion change"
  ];
  const targetSkill = skillsList[Math.floor(nextRand() * skillsList.length)];

  // 5. Estimated completion (10 to 15 minutes)
  const estimatedCompletionMin = 10 + Math.floor(nextRand() * 6);

  // 6. Difficulty
  const difficulties = ["B1", "B2", "C1"] as const;
  const difficulty = difficulties[Math.floor(nextRand() * difficulties.length)];

  return {
    dateStr,
    topicId,
    topicLabel,
    questionType: qType as "20-30" | "35-40",
    durationSec,
    targetSkill,
    estimatedCompletionMin,
    difficulty
  };
};

const EMOTION_LABELS: { [key: string]: { label: string; bg: string; text: string; emoji: string } } = {
  surpris: { label: "Surpris", bg: "bg-amber-100 border-amber-200", text: "text-amber-800", emoji: "😲" },
  surprise: { label: "Surprise", bg: "bg-amber-100 border-amber-200", text: "text-amber-800", emoji: "😲" },
  irrité: { label: "Irrité", bg: "bg-red-50 border-red-200", text: "text-red-700", emoji: "😠" },
  irritation: { label: "Irritation", bg: "bg-red-50 border-red-200", text: "text-red-700", emoji: "😠" },
  fâché: { label: "Fâché", bg: "bg-red-50 border-red-200", text: "text-red-700", emoji: "😠" },
  inquiet: { label: "Inquiet", bg: "bg-purple-100 border-purple-200", text: "text-purple-800", emoji: "😰" },
  inquiétude: { label: "Inquiétude", bg: "bg-purple-100 border-purple-200", text: "text-purple-800", emoji: "😰" },
  déçu: { label: "Déçu", bg: "bg-slate-100 border-slate-300", text: "text-slate-700", emoji: "😞" },
  déception: { label: "Déception", bg: "bg-slate-100 border-slate-300", text: "text-slate-700", emoji: "😞" },
  enthousiaste: { label: "Enthousiaste", bg: "bg-emerald-100 border-emerald-200", text: "text-emerald-800", emoji: "🤩" },
  excitation: { label: "Excitation", bg: "bg-emerald-100 border-emerald-200", text: "text-emerald-800", emoji: "🤩" },
  curieux: { label: "Curieux", bg: "bg-teal-100 border-teal-200", text: "text-teal-800", emoji: "🧐" },
  curiosité: { label: "Curiosité", bg: "bg-teal-100 border-teal-200", text: "text-teal-800", emoji: "🧐" },
  sceptique: { label: "Sceptique", bg: "bg-amber-100 border-amber-200", text: "text-amber-800", emoji: "🤨" },
  doute: { label: "Doute", bg: "bg-amber-100 border-amber-200", text: "text-amber-800", emoji: "🤨" },
  convaincu: { label: "Convaincu", bg: "bg-indigo-100 border-indigo-200", text: "text-indigo-800", emoji: "🗣️" },
  assuré: { label: "Assuré", bg: "bg-indigo-100 border-indigo-200", text: "text-indigo-800", emoji: "🗣️" },
  hésitant: { label: "Hésitant", bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-800", emoji: "🤔" },
  hésitation: { label: "Hésitation", bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-800", emoji: "🤔" },
  neutre: { label: "Neutre", bg: "bg-slate-100 border-slate-200", text: "text-slate-600", emoji: "😐" },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"practice" | "history" | "predictions">("practice");
  const [activeHistoryDetail, setActiveHistoryDetail] = useState<AdaptiveHistoryEntry | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"questions" | "transcript" | "ai_coach">("questions");
  const [requestingAICoachForHistoric, setRequestingAICoachForHistoric] = useState<string | null>(null);
  // State for session progress & database
  const [exercise, setExercise] = useState<TEFExercise | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>("random");
  const [difficulty, setDifficulty] = useState<"B1" | "B2" | "C1">("B2");
  const [activeDifficulty, setActiveDifficulty] = useState<"B1" | "B2" | "C1">("B2");
  const [questionType, setQuestionType] = useState<"20-30" | "35-40" | "mixed">("mixed");
  const [activeQuestionType, setActiveQuestionType] = useState<"20-30" | "35-40" | "mixed">("mixed");
  const [durationSec, setDurationSec] = useState<60 | 90 | 120>(90);
  const [activeDurationSec, setActiveDurationSec] = useState<number>(90);
  const [loading, setLoading] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<"conversation" | "questions" | "audio" | "idle">("idle");
  const [loadingTipIndex, setLoadingTipIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isDailyMissionSession, setIsDailyMissionSession] = useState<boolean>(false);
  const dailyMission = getDailyMission();

  // Dynamic Adaptive Difficulty State variables (with localStorage fallback)
  const [dialogueComplexity, setDialogueComplexity] = useState<"standard" | "complex" | "highly-complex">(() => {
    return (localStorage.getItem("tef_adaptive_complexity") as any) || "standard";
  });
  const [vocabularyLevel, setVocabularyLevel] = useState<"standard" | "advanced" | "highly-advanced">(() => {
    return (localStorage.getItem("tef_adaptive_vocabulary") as any) || "standard";
  });
  const [impliedMeaningIntensity, setImpliedMeaningIntensity] = useState<"standard" | "subtle" | "highly-subtle">(() => {
    return (localStorage.getItem("tef_adaptive_implied") as any) || "standard";
  });
  const [speechSpeedModifier, setSpeechSpeedModifier] = useState<"normal" | "fast" | "very-fast">(() => {
    return (localStorage.getItem("tef_adaptive_speed") as any) || "normal";
  });

  // Web Speech Fallback State
  const [isWebSpeechFallback, setIsWebSpeechFallback] = useState<boolean>(false);
  const [webSpeechPlaying, setWebSpeechPlaying] = useState<boolean>(false);
  const [webSpeechCurrentIndex, setWebSpeechCurrentIndex] = useState<number>(0);
  const webSpeechUtteranceRef = useRef<any>(null);

  // Web Speech Fallback Functions
  const playWebSpeech = (startIndex?: number) => {
    if (!exercise || !exercise.dialogue || !window.speechSynthesis) return;

    setWebSpeechPlaying(true);
    setIsPlaying(true);

    const speakLineIndex = startIndex !== undefined ? startIndex : webSpeechCurrentIndex;
    speakDialogueFromLine(speakLineIndex);
  };

  const pauseWebSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setWebSpeechPlaying(false);
    setIsPlaying(false);
  };

  const speakDialogueFromLine = (index: number) => {
    if (!exercise || !exercise.dialogue || !window.speechSynthesis) return;

    if (index >= exercise.dialogue.length) {
      setWebSpeechPlaying(false);
      setIsPlaying(false);
      setWebSpeechCurrentIndex(0);
      setCurrentTime(0);
      return;
    }

    setWebSpeechCurrentIndex(index);
    const estimatedTime = index * 5;
    setCurrentTime(estimatedTime);

    const line = exercise.dialogue[index];
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = "fr-FR";
    utterance.rate = playbackRate;
    utterance.volume = isMuted ? 0 : volume;

    const allVoices = window.speechSynthesis.getVoices();
    const frVoices = allVoices.filter((v) => v.lang.startsWith("fr"));

    if (frVoices.length > 0) {
      const isSophie = line.speaker?.toLowerCase() === "sophie" || line.voice === "female";
      const sophieVoiceOption = frVoices.find(
        (v) => v.name.includes("Aurelie") || v.name.includes("Julie") || v.name.includes("Marie") || v.name.includes("Google français") || v.name.includes("Google fr")
      ) || frVoices[0];

      const marcVoiceOption = frVoices.find(
        (v) => (v.name.includes("Thomas") || v.name.includes("Paul") || v.name.includes("Nicolas") || v.name.includes("Microsoft")) && v !== sophieVoiceOption
      ) || frVoices[Math.min(1, frVoices.length - 1)];

      utterance.voice = isSophie ? sophieVoiceOption : marcVoiceOption;
    }

    utterance.onend = () => {
      setTimeout(() => {
        setWebSpeechPlaying((currentPlaying) => {
          if (currentPlaying) {
            speakDialogueFromLine(index + 1);
          }
          return currentPlaying;
        });
      }, 800);
    };

    utterance.onerror = (e) => {
      console.warn("Speech utterance error, moving to next line", e);
      speakDialogueFromLine(index + 1);
    };

    webSpeechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Simulation Options State
  const [hideTranscript, setHideTranscript] = useState<boolean>(true);
  const [randomVoices, setRandomVoices] = useState<boolean>(true);
  const [showScore, setShowScore] = useState<boolean>(true);
  const [saveSession, setSaveSession] = useState<boolean>(true);

  // Audio Playback State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Transcript visibility state
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  // Exam Mode and Timer States
  const [examMode, setExamMode] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: "A" | "B" | "C" | "D" }>({});
  const [validatedQuestions, setValidatedQuestions] = useState<{ [key: number]: boolean }>({});
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
  const [sessionScore, setSessionScore] = useState<number>(0);
  const [selectedFeedbackIndex, setSelectedFeedbackIndex] = useState<number>(0);

  // Statistics State (Hydrated from Local Storage)
  const [totalQuestions, setTotalQuestions] = useState<number>(37);
  const [correctQuestions, setCorrectQuestions] = useState<number>(30); // 81% average
  const [totalSessions, setTotalSessions] = useState<number>(7);
  const [topicStats, setTopicStats] = useState<TopicStats>({});

  // Sub-skill statistics matching Phase 7
  const [skillStats, setSkillStats] = useState<{ [key: string]: { correct: number; total: number } }>({
    "Implicit opinion": { correct: 3, total: 4 },
    "Explicit information": { correct: 4, total: 4 },
    "Speaker intention": { correct: 3, total: 4 },
    "Recommendation": { correct: 3, total: 3 },
    "Concession": { correct: 2, total: 3 },
    "Negation": { correct: 4, total: 4 },
    "Double negation": { correct: 1, total: 3 },
    "Inference": { correct: 2, total: 3 },
    "Purpose": { correct: 3, total: 3 },
    "Attitude": { correct: 3, total: 3 },
    "Opinion change": { correct: 2, total: 3 },
  });

  const [historicalMastery, setHistoricalMastery] = useState<MasterySnapshot[]>([]);

  const [adaptiveHistory, setAdaptiveHistory] = useState<AdaptiveHistoryEntry[]>([]);

  // Phase 8 - AI Coach State
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState<boolean>(false);

  const [todayStats, setTodayStats] = useState<{ correct: number; total: number }>({
    correct: 4,
    total: 5, // 80%
  });

  const [weekStats, setWeekStats] = useState<{ correct: number; total: number }>({
    correct: 21,
    total: 25, // 84%
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load stats from Local Storage on mount
  useEffect(() => {
    const storedTotal = localStorage.getItem("tef_total_questions");
    const storedCorrect = localStorage.getItem("tef_correct_answers");
    const storedSessions = localStorage.getItem("tef_total_sessions");
    const storedTopicStats = localStorage.getItem("tef_topic_stats");
    const storedSkillStats = localStorage.getItem("tef_skill_stats");
    const storedTodayStats = localStorage.getItem("tef_today_stats");
    const storedWeekStats = localStorage.getItem("tef_week_stats");

    if (storedTotal) {
      setTotalQuestions(parseInt(storedTotal, 10));
    } else {
      localStorage.setItem("tef_total_questions", "37");
    }

    if (storedCorrect) {
      setCorrectQuestions(parseInt(storedCorrect, 10));
    } else {
      localStorage.setItem("tef_correct_answers", "30");
    }

    if (storedSessions) {
      setTotalSessions(parseInt(storedSessions, 10));
    } else {
      localStorage.setItem("tef_total_sessions", "7");
    }

    if (storedTopicStats) {
      try {
        setTopicStats(JSON.parse(storedTopicStats));
      } catch (e) {
        console.error("Error parsing stored topic stats:", e);
      }
    }

    if (storedSkillStats) {
      try {
        setSkillStats(JSON.parse(storedSkillStats));
      } catch (e) {
        console.error("Error parsing stored skill stats:", e);
      }
    } else {
      localStorage.setItem("tef_skill_stats", JSON.stringify({
        "Implicit opinion": { correct: 3, total: 4 },
        "Explicit information": { correct: 4, total: 4 },
        "Speaker intention": { correct: 3, total: 4 },
        "Recommendation": { correct: 3, total: 3 },
        "Concession": { correct: 2, total: 3 },
        "Negation": { correct: 4, total: 4 },
        "Double negation": { correct: 1, total: 3 },
        "Inference": { correct: 2, total: 3 },
        "Purpose": { correct: 3, total: 3 },
        "Attitude": { correct: 3, total: 3 },
        "Opinion change": { correct: 2, total: 3 },
      }));
    }

    if (storedTodayStats) {
      try {
        setTodayStats(JSON.parse(storedTodayStats));
      } catch (e) {
        console.error("Error parsing stored today stats:", e);
      }
    } else {
      localStorage.setItem("tef_today_stats", JSON.stringify({ correct: 4, total: 5 }));
    }

    if (storedWeekStats) {
      try {
        setWeekStats(JSON.parse(storedWeekStats));
      } catch (e) {
        console.error("Error parsing stored week stats:", e);
      }
    } else {
      localStorage.setItem("tef_week_stats", JSON.stringify({ correct: 21, total: 25 }));
    }

    const storedAdaptiveHistory = localStorage.getItem("tef_adaptive_history");
    if (storedAdaptiveHistory) {
      try {
        setAdaptiveHistory(JSON.parse(storedAdaptiveHistory));
      } catch (e) {
        console.error("Error parsing stored adaptive history:", e);
      }
    } else {
      const initialHistory: AdaptiveHistoryEntry[] = [
        {
          id: "mock-1",
          timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
          topic: "housing",
          difficulty: "B2",
          questionType: "20-30",
          score: 4,
          total: 5,
          elapsedTime: 92,
          weakSkills: ["Implicit opinion"],
          dialogueTopicSummary: "Débat sur la colocation intergénérationnelle en France."
        },
        {
          id: "mock-2",
          timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          topic: "work",
          difficulty: "C1",
          questionType: "35-40",
          score: 3,
          total: 5,
          elapsedTime: 118,
          weakSkills: ["Double negatives", "Concession"],
          dialogueTopicSummary: "Entretien d'embauche tendu sur le télétravail et la flexibilité."
        },
        {
          id: "mock-3",
          timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
          topic: "travel",
          difficulty: "B1",
          questionType: "20-30",
          score: 5,
          total: 5,
          elapsedTime: 65,
          weakSkills: [],
          dialogueTopicSummary: "Message vocal d'une agence de voyage annulant un vol d'avion."
        },
        {
          id: "mock-4",
          timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          topic: "environment",
          difficulty: "B2",
          questionType: "mixed",
          score: 4,
          total: 5,
          elapsedTime: 88,
          weakSkills: ["Double negatives"],
          dialogueTopicSummary: "Discussion sur l'interdiction des emballages plastiques à usage unique."
        },
        {
          id: "mock-5",
          timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          topic: "shopping",
          difficulty: "B2",
          questionType: "20-30",
          score: 5,
          total: 5,
          elapsedTime: 72,
          weakSkills: [],
          dialogueTopicSummary: "Micro-trottoir sur les habitudes d'achat en friperie et seconde main."
        },
        {
          id: "mock-6",
          timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          topic: "health",
          difficulty: "C1",
          questionType: "35-40",
          score: 4,
          total: 5,
          elapsedTime: 125,
          weakSkills: ["Concession"],
          dialogueTopicSummary: "Débat radiophonique sur l'utilisation de l'IA en médecine."
        },
        {
          id: "mock-7",
          timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          topic: "technology",
          difficulty: "B2",
          questionType: "mixed",
          score: 5,
          total: 5,
          elapsedTime: 95,
          weakSkills: [],
          dialogueTopicSummary: "Message explicatif sur la transition numérique d'une entreprise locale."
        }
      ];
      setAdaptiveHistory(initialHistory);
      localStorage.setItem("tef_adaptive_history", JSON.stringify(initialHistory));
    }

    const storedHistoricalMastery = localStorage.getItem("tef_historical_mastery");
    if (storedHistoricalMastery) {
      try {
        setHistoricalMastery(JSON.parse(storedHistoricalMastery));
      } catch (e) {
        console.error("Error parsing stored historical mastery:", e);
      }
    } else {
      const initialMastery: MasterySnapshot[] = [
        {
          timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
          sessionName: "Session 1: Logement",
          overallAccuracy: 60,
          tefScore: 320,
        },
        {
          timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          sessionName: "Session 2: Travail",
          overallAccuracy: 64,
          tefScore: 370,
        },
        {
          timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
          sessionName: "Session 3: Voyage",
          overallAccuracy: 71,
          tefScore: 410,
        },
        {
          timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          sessionName: "Session 4: Environnement",
          overallAccuracy: 75,
          tefScore: 430,
        },
        {
          timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          sessionName: "Session 5: Achats",
          overallAccuracy: 78,
          tefScore: 460,
        },
        {
          timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          sessionName: "Session 6: Santé",
          overallAccuracy: 81,
          tefScore: 510,
        },
        {
          timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          sessionName: "Session 7: Technologie",
          overallAccuracy: 83,
          tefScore: 520,
        },
      ];
      setHistoricalMastery(initialMastery);
      localStorage.setItem("tef_historical_mastery", JSON.stringify(initialMastery));
    }
  }, []);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Synchronize playback speed to web speech if active
  useEffect(() => {
    if (isWebSpeechFallback && webSpeechPlaying) {
      window.speechSynthesis.cancel();
      speakDialogueFromLine(webSpeechCurrentIndex);
    }
  }, [playbackRate]);

  // Synchronize volume and mute to web speech if active
  useEffect(() => {
    if (isWebSpeechFallback && webSpeechPlaying && webSpeechUtteranceRef.current) {
      webSpeechUtteranceRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Update loading tip periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
      }, 6000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Sync audio timeline
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleMetadata = () => {
      setDuration(audio.duration || 0);
      audio.playbackRate = playbackRate;
      audio.volume = volume;
      audio.muted = isMuted;
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleMetadata);
    audio.addEventListener("canplay", handleMetadata);

    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = isMuted;

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleMetadata);
      audio.removeEventListener("canplay", handleMetadata);
    };
  }, [audioUrl, playbackRate, volume, isMuted]);

  // Timer effect for elapsed time in Exam Mode
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (exercise && !quizFinished) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) {
        clearInterval(interval);
      }
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [exercise, quizFinished]);

  // Reset Stats function
  const handleResetStats = () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser toutes vos statistiques de progression ?")) {
      localStorage.removeItem("tef_total_questions");
      localStorage.removeItem("tef_correct_answers");
      localStorage.removeItem("tef_total_sessions");
      localStorage.removeItem("tef_topic_stats");
      localStorage.removeItem("tef_skill_stats");
      localStorage.removeItem("tef_today_stats");
      localStorage.removeItem("tef_week_stats");
      localStorage.removeItem("tef_adaptive_history");
      localStorage.removeItem("tef_historical_mastery");
      localStorage.removeItem("tef_adaptive_complexity");
      localStorage.removeItem("tef_adaptive_vocabulary");
      localStorage.removeItem("tef_adaptive_implied");
      localStorage.removeItem("tef_adaptive_speed");
      setTotalQuestions(0);
      setCorrectQuestions(0);
      setTotalSessions(0);
      setDialogueComplexity("standard");
      setVocabularyLevel("standard");
      setImpliedMeaningIntensity("standard");
      setSpeechSpeedModifier("normal");
      setTopicStats({});
      setSkillStats({
        "Implicit opinion": { correct: 0, total: 0 },
        "Explicit information": { correct: 0, total: 0 },
        "Speaker intention": { correct: 0, total: 0 },
        "Recommendation": { correct: 0, total: 0 },
        "Concession": { correct: 0, total: 0 },
        "Negation": { correct: 0, total: 0 },
        "Double negation": { correct: 0, total: 0 },
        "Inference": { correct: 0, total: 0 },
        "Purpose": { correct: 0, total: 0 },
        "Attitude": { correct: 0, total: 0 },
        "Opinion change": { correct: 0, total: 0 },
      });
      setHistoricalMastery([]);
      setAdaptiveHistory([]);
      setTodayStats({ correct: 0, total: 0 });
      setWeekStats({ correct: 0, total: 0 });
      setCoachFeedback(null);
      setLoadingCoach(false);
    }
  };

  // Generate Exercise (Conversation & Questions)
  const handleGenerateExercise = async (overrides?: {
    topic?: string;
    difficulty?: "B1" | "B2" | "C1";
    questionType?: "20-30" | "35-40" | "mixed";
    durationSec?: number;
    isDaily?: boolean;
  }) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsWebSpeechFallback(false);
    setWebSpeechPlaying(false);
    setWebSpeechCurrentIndex(0);
    setExercise(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowTranscript(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setValidatedQuestions({});
    setQuizFinished(false);
    setSessionScore(0);
    setElapsedTime(0);
    setSelectedFeedbackIndex(0);
    setCoachFeedback(null);
    setLoadingCoach(false);
    setError(null);
    setLoading(true);

    const actualTopic = overrides?.topic !== undefined ? overrides.topic : selectedTopic;
    const actualDifficulty = overrides?.difficulty !== undefined ? overrides.difficulty : difficulty;
    const actualQuestionType = overrides?.questionType !== undefined ? overrides.questionType : questionType;
    const actualDurationSec = overrides?.durationSec !== undefined ? overrides.durationSec : durationSec;

    setIsDailyMissionSession(!!overrides?.isDaily);

    // Analyze weaknesses for adaptive generation
    const topicsList = ["work", "travel", "housing", "environment", "shopping", "education", "health", "technology"];
    const topicAccuracies = topicsList.map(topicId => {
      const stat = topicStats[topicId] || { correct: 0, total: 0 };
      const accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 100;
      return { id: topicId, accuracy, total: stat.total };
    });
    const sortedTopics = [...topicAccuracies].sort((a, b) => {
      if (a.total === 0 && b.total > 0) return -1;
      if (b.total === 0 && a.total > 0) return 1;
      return a.accuracy - b.accuracy;
    });
    const weakTopic = sortedTopics[0]?.id || "work";

    const sortedSkills = (Object.entries(skillStats) as [string, { correct: number; total: number }][])
      .map(([skill, stat]) => {
        const accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 100;
        return { skill, accuracy, total: stat.total };
      })
      .sort((a, b) => {
        if (a.total === 0 && b.total > 0) return -1;
        if (b.total === 0 && a.total > 0) return 1;
        return a.accuracy - b.accuracy;
      });
    const weakSkills = sortedSkills.map(s => s.skill);

    let qTypeAccuracy = { "20-30": { correct: 0, total: 0 }, "35-40": { correct: 0, total: 0 } };
    adaptiveHistory.forEach(h => {
      if (h.questionType === "20-30" || h.questionType === "35-40") {
        qTypeAccuracy[h.questionType].correct += h.score;
        qTypeAccuracy[h.questionType].total += 5;
      }
    });
    let weakQuestionType: "20-30" | "35-40" | "mixed" = "mixed";
    const t2030 = qTypeAccuracy["20-30"];
    const t3540 = qTypeAccuracy["35-40"];
    const acc2030 = t2030.total > 0 ? t2030.correct / t2030.total : 1.0;
    const acc3540 = t3540.total > 0 ? t3540.correct / t3540.total : 1.0;
    if (t2030.total > 0 || t3540.total > 0) {
      if (acc2030 < acc3540) {
        weakQuestionType = "20-30";
      } else if (acc3540 < acc2030) {
        weakQuestionType = "35-40";
      }
    }

    const pastSessions = adaptiveHistory.slice(-10).map(h => ({
      topic: h.topic,
      difficulty: h.difficulty,
      questionType: h.questionType,
      summary: h.dialogueTopicSummary || ""
    }));

    const adaptiveContext = {
      weakTopic,
      weakSkills,
      weakQuestionType,
      pastSessions,
      dialogueComplexity,
      vocabularyLevel,
      impliedMeaningIntensity,
      speechSpeedModifier
    };

    // Adjust playback rate automatically based on speed modifier
    let speedRate = 1.0;
    if (speechSpeedModifier === "fast") {
      speedRate = 1.1;
    } else if (speechSpeedModifier === "very-fast") {
      speedRate = 1.2;
    }
    setPlaybackRate(speedRate);

    try {
      // Step 1: AI Conversation Generator (Module 1)
      setGenerationStep("conversation");
      const convResponse = await fetch("/api/generate-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedTopic: actualTopic === "random" ? "adaptive" : actualTopic,
          difficulty: actualDifficulty,
          questionType: actualQuestionType === "mixed" ? "adaptive" : actualQuestionType,
          durationSec: actualDurationSec,
          adaptiveContext
        }),
      });

      if (!convResponse.ok) {
        const errData = await convResponse.json();
        throw new Error(errData.error || "Une erreur est survenue lors de la génération de la conversation.");
      }

      const convData = await convResponse.json();

      // Step 2: AI Question Generator (Module 2)
      setGenerationStep("questions");
      const qResponse = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogue: convData.dialogue,
          transcript: convData.transcript,
          topic: convData.topic,
          subTopic: convData.subTopic,
          difficulty: actualDifficulty,
          questionType: actualQuestionType === "mixed" ? "adaptive" : actualQuestionType,
          adaptiveContext
        }),
      });

      if (!qResponse.ok) {
        const errData = await qResponse.json();
        throw new Error(errData.error || "Une erreur est survenue lors de la génération des questions de l'examen.");
      }

      const qData = await qResponse.json();

      // Merge results into standard TEFExercise format (Module 3 Scoring Engine will consume this)
      const data: TEFExercise = {
        topic: convData.topic,
        subTopic: convData.subTopic,
        duration: convData.duration,
        dialogue: convData.dialogue,
        transcript: convData.transcript,
        questions: qData.questions
      };

      setExercise(data);
      setActiveDifficulty(actualDifficulty);
      setActiveQuestionType(actualQuestionType);
      setActiveDurationSec(actualDurationSec);

      // Increment sessions count if saveSession is enabled
      if (saveSession) {
        const nextSessionsCount = totalSessions + 1;
        setTotalSessions(nextSessionsCount);
        localStorage.setItem("tef_total_sessions", nextSessionsCount.toString());
      }

      // Step 3: AI Voice Synthesis (Audio generation)
      setGenerationStep("audio");
      await generateTTS(data.dialogue, actualDifficulty);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Impossible de générer l'entraînement. Veuillez réessayer.");
    } finally {
      setLoading(false);
      setGenerationStep("idle");
    }
  };

  // Generate TTS Audio via Server API
  const generateTTS = async (dialogue: DialogueLine[], ttsDifficulty: string) => {
    setLoadingAudio(true);
    setIsWebSpeechFallback(false);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogue, randomVoices }),
      });

      if (!response.ok) {
        throw new Error("Impossible de synthétiser les voix de Sophie et Marc.");
      }

      const data = await response.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        if (data.duration) {
          setDuration(data.duration);
        }
      } else {
        throw new Error("No audioUrl in response");
      }
    } catch (err: any) {
      console.warn("TTS Generation failed, falling back to Web Speech API:", err);
      setIsWebSpeechFallback(true);
      setDuration(dialogue.length * 5);
      setCurrentTime(0);
      setWebSpeechCurrentIndex(0);
      setWebSpeechPlaying(false);
    } finally {
      setLoadingAudio(false);
    }
  };

  // Generate local rule-based coaching feedback as a high-quality fallback
  const generateLocalCoachFeedback = (
    score: number,
    currentExercise: TEFExercise,
    currentAnswers: { [key: number]: "A" | "B" | "C" | "D" },
    stats: any
  ): string => {
    const incorrectSkills: string[] = [];
    currentExercise.questions.forEach((q) => {
      const isCorrect = currentAnswers[q.id] === q.correctAnswer;
      if (!isCorrect) {
        incorrectSkills.push(q.skillTested || "Implicit opinion");
      }
    });

    const uniqueIncorrects = Array.from(new Set(incorrectSkills));
    
    // Strengths section
    let strengthsText = "";
    if (score === 5) {
      strengthsText = "- Maîtrise absolue du niveau **" + activeDifficulty + "**.\n- Excellente **écoute active** et décodage parfait des indices verbaux.";
    } else if (score >= 3) {
      strengthsText = "- Bonne **compréhension globale** de l'échange.\n- Repérage efficace des **idées principales** de Sophie et Marc.";
    } else {
      strengthsText = "- Volonté d'apprentissage sur un niveau **défiant**.\n- Identification de certains **mots-clés** essentiels.";
    }

    // Needs Improvement section
    let needsImprovementText = "";
    if (uniqueIncorrects.length > 0) {
      const skill = uniqueIncorrects[0];
      needsImprovementText = "- Difficulté sur le décodage de : **" + formatSkillDisplay(skill) + "**.\n- Besoin d'affiner l'écoute des **nuances expressives**.";
    } else {
      needsImprovementText = "- Aucun point faible majeur détecté lors de cette épreuve.\n- Continue à maintenir ce haut niveau de **vigilance auditive**.";
    }

    // Today's Trap section
    let trapText = "";
    if (uniqueIncorrects.includes("Concession")) {
      trapText = "- Le piège classique : un changement d'avis introduit par un mot de liaison comme **certes** ou **bien que**.";
    } else if (uniqueIncorrects.includes("Implicit opinion")) {
      trapText = "- L'opinion de Sophie/Marc n'est pas explicite; elle se cache dans l'**intonation** ou l'usage de l'**ironie**.";
    } else if (uniqueIncorrects.includes("Double negation")) {
      trapText = "- Attention aux **doubles négations** qui masquent en réalité une affirmation simple.";
    } else {
      trapText = "- Les **distracteurs lexicaux** : Sophie et Marc utilisent des mots similaires à la question mais avec un sens détourné.";
    }

    // Tomorrow's Focus section
    let focusText = "";
    const weakestSkillEntry = (Object.entries(stats) as [string, { correct: number; total: number }][])
      .sort((a, b) => {
        const pctA = a[1].total > 0 ? (a[1].correct / a[1].total) : 0;
        const pctB = b[1].total > 0 ? (b[1].correct / b[1].total) : 0;
        return pctA - pctB;
      })[0];
    
    if (weakestSkillEntry) {
      focusText = "- Demain, nous ciblerons en priorité : **" + formatSkillDisplay(weakestSkillEntry[0]) + "**.\n- Pratique de l'**écoute ciblée** sans distracteurs.";
    } else {
      focusText = "- Session d'entraînement adaptative concentrée sur les **opinions complexes**.";
    }

    return "### Strengths\n" + strengthsText + "\n\n### Needs Improvement\n" + needsImprovementText + "\n\n### Today's Trap\n" + trapText + "\n\n### Tomorrow's Focus\n" + focusText;
  };

  // Fetch feedback from the AI Coach endpoint (falls back to local rule-based generation)
  const fetchCoachFeedback = async (
    score: number,
    currentExercise: TEFExercise,
    currentAnswers: { [key: number]: "A" | "B" | "C" | "D" },
    currentSkillStats: any
  ) => {
    setLoadingCoach(true);
    setCoachFeedback(null);
    try {
      const sessionQuestions = currentExercise.questions.map((q) => ({
        text: q.questionText,
        skillTested: q.skillTested || "Implicit opinion",
        correctAnswer: q.correctAnswer,
        userAnswer: currentAnswers[q.id],
        isCorrect: currentAnswers[q.id] === q.correctAnswer,
      }));

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionQuestions,
          sessionScore: score,
          skillStats: currentSkillStats,
          activeDifficulty,
        }),
      });

      if (!response.ok) {
        throw new Error("Impossible de joindre le Coach IA.");
      }

      const data = await response.json();
      if (data.feedback) {
        setCoachFeedback(data.feedback);
        setAdaptiveHistory((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            coachFeedback: data.feedback,
          };
          localStorage.setItem("tef_adaptive_history", JSON.stringify(updated));
          return updated;
        });
      } else {
        throw new Error("Aucun feedback généré.");
      }
    } catch (err: any) {
      console.warn("AI Coach API fell back to rule-based generation:", err);
      const fallback = generateLocalCoachFeedback(score, currentExercise, currentAnswers, currentSkillStats);
      setCoachFeedback(fallback);
      setAdaptiveHistory((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          coachFeedback: fallback,
        };
        localStorage.setItem("tef_adaptive_history", JSON.stringify(updated));
        return updated;
      });
    } finally {
      setLoadingCoach(false);
    }
  };

  // Audio actions
  const togglePlay = () => {
    if (isWebSpeechFallback) {
      if (webSpeechPlaying) {
        pauseWebSpeech();
      } else {
        playWebSpeech();
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch((e) => console.error("Error playing audio:", e));
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (isWebSpeechFallback) {
      if (exercise && exercise.dialogue) {
        const lineIndex = Math.min(
          exercise.dialogue.length - 1,
          Math.max(0, Math.floor(seekTime / 5))
        );
        setWebSpeechCurrentIndex(lineIndex);
        setCurrentTime(seekTime);
        if (webSpeechPlaying) {
          window.speechSynthesis.cancel();
          speakDialogueFromLine(lineIndex);
        }
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (!isWebSpeechFallback) {
      const audio = audioRef.current;
      if (audio) {
        audio.volume = vol;
      }
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!isWebSpeechFallback) {
      const audio = audioRef.current;
      if (audio) {
        audio.muted = nextMuted;
      }
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const padMin = minutes < 10 ? "0" : "";
    const padSec = seconds < 10 ? "0" : "";
    return `${padMin}${minutes}:${padSec}${seconds}`;
  };

  const skipBackward = () => {
    if (isWebSpeechFallback) {
      const nextIndex = Math.max(0, webSpeechCurrentIndex - 1);
      setWebSpeechCurrentIndex(nextIndex);
      setCurrentTime(nextIndex * 5);
      if (webSpeechPlaying) {
        window.speechSynthesis.cancel();
        speakDialogueFromLine(nextIndex);
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      const nextTime = Math.max(0, audio.currentTime - 10);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const skipForward = () => {
    if (isWebSpeechFallback) {
      if (exercise && exercise.dialogue) {
        const nextIndex = Math.min(exercise.dialogue.length - 1, webSpeechCurrentIndex + 1);
        setWebSpeechCurrentIndex(nextIndex);
        setCurrentTime(nextIndex * 5);
        if (webSpeechPlaying) {
          window.speechSynthesis.cancel();
          speakDialogueFromLine(nextIndex);
        }
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      const nextTime = Math.min(duration || 0, audio.currentTime + 10);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const getBlockProgressBar = () => {
    const totalBlocks = 20;
    const ratio = duration ? currentTime / duration : 0;
    const filledBlocks = Math.round(ratio * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return "█".repeat(filledBlocks) + "░".repeat(Math.max(0, emptyBlocks));
  };

  // Submit Answer
  const handleSelectOption = (questionId: number, optionKey: "A" | "B" | "C" | "D") => {
    if (quizFinished) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const handleSubmitExam = () => {
    if (!exercise) return;

    // Stop playback if playing
    if (isWebSpeechFallback) {
      pauseWebSpeech();
    } else {
      const audio = audioRef.current;
      if (audio && isPlaying) {
        audio.pause();
        setIsPlaying(false);
      }
    }

    let score = 0;
    const nextValidated: { [key: number]: boolean } = {};

    exercise.questions.forEach((q) => {
      const chosen = selectedAnswers[q.id];
      const isCorrect = chosen === q.correctAnswer;
      if (isCorrect) {
        score += 1;
      }
      nextValidated[q.id] = true;
    });

    setSessionScore(score);
    setValidatedQuestions(nextValidated);

    let statsToPass = { ...skillStats };

    if (saveSession) {
      // Save statistics incrementally (all 5 questions at once)
      const updatedTotal = totalQuestions + 5;
      const updatedCorrect = correctQuestions + score;

      setTotalQuestions(updatedTotal);
      setCorrectQuestions(updatedCorrect);

      localStorage.setItem("tef_total_questions", updatedTotal.toString());
      localStorage.setItem("tef_correct_answers", updatedCorrect.toString());

      // Update topic statistics
      const topicKey = exercise.topic || "general";
      const currentTopicStat = topicStats[topicKey] || { correct: 0, total: 0 };
      const updatedTopicStat = {
        correct: currentTopicStat.correct + score,
        total: currentTopicStat.total + 5,
      };

      const updatedTopicStats = {
        ...topicStats,
        [topicKey]: updatedTopicStat,
      };

      setTopicStats(updatedTopicStats);
      localStorage.setItem("tef_topic_stats", JSON.stringify(updatedTopicStats));

      // Update sub-skill statistics
      const updatedSkillStats = { ...skillStats };
      exercise.questions.forEach((q, idx) => {
        const skillKey = normalizeSkill(q.skillTested || "Implicit opinion", idx);
        const currentSkillStat = updatedSkillStats[skillKey] || { correct: 0, total: 0 };
        const chosen = selectedAnswers[q.id];
        const isCorrect = chosen === q.correctAnswer;

        updatedSkillStats[skillKey] = {
          correct: currentSkillStat.correct + (isCorrect ? 1 : 0),
          total: currentSkillStat.total + 1,
        };
      });

      setSkillStats(updatedSkillStats);
      localStorage.setItem("tef_skill_stats", JSON.stringify(updatedSkillStats));
      statsToPass = updatedSkillStats;

      // Update Today Stats
      const updatedToday = {
        correct: todayStats.correct + score,
        total: todayStats.total + 5,
      };
      setTodayStats(updatedToday);
      localStorage.setItem("tef_today_stats", JSON.stringify(updatedToday));

      // Update Week Stats
      const updatedWeek = {
        correct: weekStats.correct + score,
        total: weekStats.total + 5,
      };
      setWeekStats(updatedWeek);
      localStorage.setItem("tef_week_stats", JSON.stringify(updatedWeek));

      // Save Adaptive History Entry
      const currentSessionWeakSkills: string[] = [];
      exercise.questions.forEach((q, idx) => {
        const skillKey = normalizeSkill(q.skillTested || "Implicit opinion", idx);
        const chosen = selectedAnswers[q.id];
        const isCorrect = chosen === q.correctAnswer;
        if (!isCorrect && !currentSessionWeakSkills.includes(skillKey)) {
          currentSessionWeakSkills.push(skillKey);
        }
      });

      let sessionScoreVal = 0;
      const sessionAccuracy = (score / 5) * 100;
      if (sessionAccuracy < 30) {
        sessionScoreVal = Math.round((sessionAccuracy / 30) * 199);
      } else if (sessionAccuracy < 50) {
        sessionScoreVal = Math.round(200 + ((sessionAccuracy - 30) / 20) * 99);
      } else if (sessionAccuracy < 70) {
        sessionScoreVal = Math.round(300 + ((sessionAccuracy - 50) / 20) * 99);
      } else if (sessionAccuracy < 85) {
        sessionScoreVal = Math.round(400 + ((sessionAccuracy - 70) / 15) * 99);
      } else if (sessionAccuracy < 95) {
        sessionScoreVal = Math.round(500 + ((sessionAccuracy - 85) / 10) * 99);
      } else {
        sessionScoreVal = Math.round(600 + ((sessionAccuracy - 95) / 5) * 99);
        if (sessionScoreVal > 699) sessionScoreVal = 699;
      }

      const newHistoryEntry: AdaptiveHistoryEntry = {
        id: "session-" + Date.now(),
        timestamp: new Date().toISOString(),
        topic: exercise.topic || "general",
        difficulty: activeDifficulty,
        questionType: activeQuestionType === "mixed" ? "mixed" : (activeQuestionType as "20-30" | "35-40"),
        score: score,
        total: 5,
        elapsedTime: elapsedTime,
        weakSkills: currentSessionWeakSkills,
        dialogueTopicSummary: exercise.subTopic || (exercise.dialogue && exercise.dialogue[0] ? exercise.dialogue[0].text.substring(0, 80) + "..." : "Sujet d'évaluation TEF"),
        exercise: exercise,
        selectedAnswers: selectedAnswers,
        estimatedTefScore: sessionScoreVal
      };

      const updatedHistory = [...adaptiveHistory, newHistoryEntry];
      setAdaptiveHistory(updatedHistory);
      localStorage.setItem("tef_adaptive_history", JSON.stringify(updatedHistory));

      // Add MasterySnapshot for improvement over time tracking
      const newTotalQuestions = updatedTotal;
      const newCorrectQuestions = updatedCorrect;
      const newAccuracy = newTotalQuestions > 0 ? Math.round((newCorrectQuestions / newTotalQuestions) * 100) : 0;
      
      // Calculate estimated TEF score based on newAccuracy
      let scoreVal = 0;
      if (newAccuracy < 30) {
        scoreVal = Math.round((newAccuracy / 30) * 199);
      } else if (newAccuracy < 50) {
        scoreVal = Math.round(200 + ((newAccuracy - 30) / 20) * 99);
      } else if (newAccuracy < 70) {
        scoreVal = Math.round(300 + ((newAccuracy - 50) / 20) * 99);
      } else if (newAccuracy < 85) {
        scoreVal = Math.round(400 + ((newAccuracy - 70) / 15) * 99);
      } else if (newAccuracy < 95) {
        scoreVal = Math.round(500 + ((newAccuracy - 85) / 10) * 99);
      } else {
        scoreVal = Math.round(600 + ((newAccuracy - 95) / 5) * 99);
        if (scoreVal > 699) scoreVal = 699;
      }

      const newSnapshot: MasterySnapshot = {
        timestamp: new Date().toISOString(),
        sessionName: `Session ${totalSessions}: ${TOPICS.find(t => t.id === topicKey)?.label || topicKey}`,
        overallAccuracy: newAccuracy,
        tefScore: scoreVal,
      };

      const updatedMastery = [...historicalMastery, newSnapshot];
      setHistoricalMastery(updatedMastery);
      localStorage.setItem("tef_historical_mastery", JSON.stringify(updatedMastery));

      // --- MOTEUR D'ADAPTATION DE DIFFICULTÉ AUTOMATIQUE ---
      // If user scores >= 90% (5/5 is 100%): Increase difficulty parameters
      if (score === 5) {
        let nextComplexity = dialogueComplexity;
        let nextVocab = vocabularyLevel;
        let nextImplied = impliedMeaningIntensity;
        let nextSpeed = speechSpeedModifier;
        let nextDifficulty = activeDifficulty;

        if (dialogueComplexity === "standard") nextComplexity = "complex";
        else if (dialogueComplexity === "complex") nextComplexity = "highly-complex";

        if (vocabularyLevel === "standard") nextVocab = "advanced";
        else if (vocabularyLevel === "advanced") nextVocab = "highly-advanced";

        if (impliedMeaningIntensity === "standard") nextImplied = "subtle";
        else if (impliedMeaningIntensity === "subtle") nextImplied = "highly-subtle";

        if (speechSpeedModifier === "normal") nextSpeed = "fast";
        else if (speechSpeedModifier === "fast") nextSpeed = "very-fast";

        if (activeDifficulty === "B1") nextDifficulty = "B2";
        else if (activeDifficulty === "B2") nextDifficulty = "C1";

        setDialogueComplexity(nextComplexity);
        setVocabularyLevel(nextVocab);
        setImpliedMeaningIntensity(nextImplied);
        setSpeechSpeedModifier(nextSpeed);
        setDifficulty(nextDifficulty);

        localStorage.setItem("tef_adaptive_complexity", nextComplexity);
        localStorage.setItem("tef_adaptive_vocabulary", nextVocab);
        localStorage.setItem("tef_adaptive_implied", nextImplied);
        localStorage.setItem("tef_adaptive_speed", nextSpeed);
        localStorage.setItem("tef_difficulty", nextDifficulty);
      }
      // If score drops (<= 3/5 correct, i.e. <= 60%): Reduce difficulty parameters but keep B2 objective as baseline
      else if (score <= 3) {
        let nextComplexity = dialogueComplexity;
        let nextVocab = vocabularyLevel;
        let nextImplied = impliedMeaningIntensity;
        let nextSpeed = speechSpeedModifier;
        let nextDifficulty = activeDifficulty;

        if (dialogueComplexity === "highly-complex") nextComplexity = "complex";
        else if (dialogueComplexity === "complex") nextComplexity = "standard";

        if (vocabularyLevel === "highly-advanced") nextVocab = "advanced";
        else if (vocabularyLevel === "advanced") nextVocab = "standard";

        if (impliedMeaningIntensity === "highly-subtle") nextImplied = "subtle";
        else if (impliedMeaningIntensity === "subtle") nextImplied = "standard";

        if (speechSpeedModifier === "very-fast") nextSpeed = "fast";
        else if (speechSpeedModifier === "fast") nextSpeed = "normal";

        // Keep B2 objective (never drop below B2 when adapting down)
        nextDifficulty = "B2";

        setDialogueComplexity(nextComplexity);
        setVocabularyLevel(nextVocab);
        setImpliedMeaningIntensity(nextImplied);
        setSpeechSpeedModifier(nextSpeed);
        setDifficulty(nextDifficulty);

        localStorage.setItem("tef_adaptive_complexity", nextComplexity);
        localStorage.setItem("tef_adaptive_vocabulary", nextVocab);
        localStorage.setItem("tef_adaptive_implied", nextImplied);
        localStorage.setItem("tef_adaptive_speed", nextSpeed);
        localStorage.setItem("tef_difficulty", nextDifficulty);
      }
    }

    setQuizFinished(true);
    // If hideTranscript is enabled, don't automatically open transcript; otherwise open it
    setShowTranscript(!hideTranscript);
    setCurrentQuestionIndex(0); // Reset index to 0 so they can review starting from question 1

    fetchCoachFeedback(score, exercise, selectedAnswers, statsToPass);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < 4) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleOpenHistoryDetails = (entry: AdaptiveHistoryEntry, subTab: "questions" | "transcript" | "ai_coach") => {
    setActiveHistoryDetail(entry);
    setActiveHistoryTab(subTab);
  };

  const handleReplaySession = (entry: AdaptiveHistoryEntry) => {
    if (!entry.exercise) {
      alert("Désolé, cette session factice d'historique ne dispose pas d'enregistrement. Veuillez démarrer une nouvelle épreuve réelle pour l'essayer !");
      return;
    }
    setExercise(entry.exercise);
    setQuizFinished(false);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setElapsedTime(0);
    setIsWebSpeechFallback(false);
    setActiveTab("practice");
  };

  const getSessionTEFScore = (score: number): number => {
    const accuracy = (score / 5) * 100;
    let scoreVal = 0;
    if (accuracy < 30) {
      scoreVal = Math.round((accuracy / 30) * 199);
    } else if (accuracy < 50) {
      scoreVal = Math.round(200 + ((accuracy - 30) / 20) * 99);
    } else if (accuracy < 70) {
      scoreVal = Math.round(300 + ((accuracy - 50) / 20) * 99);
    } else if (accuracy < 85) {
      scoreVal = Math.round(400 + ((accuracy - 70) / 15) * 99);
    } else if (accuracy < 95) {
      scoreVal = Math.round(500 + ((accuracy - 85) / 10) * 99);
    } else {
      scoreVal = Math.round(600 + ((accuracy - 95) / 5) * 99);
      if (scoreVal > 699) scoreVal = 699;
    }
    return scoreVal;
  };

  const handleRequestHistoricAICoach = async (entry: AdaptiveHistoryEntry) => {
    if (!entry.exercise) return;
    setRequestingAICoachForHistoric(entry.id);
    try {
      const sessionQuestions = entry.exercise.questions.map((q) => ({
        text: q.questionText,
        skillTested: q.skillTested || "Implicit opinion",
        correctAnswer: q.correctAnswer,
        userAnswer: entry.selectedAnswers ? entry.selectedAnswers[q.id] : "A",
        isCorrect: entry.selectedAnswers ? entry.selectedAnswers[q.id] === q.correctAnswer : false,
      }));

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionQuestions,
          sessionScore: entry.score,
          skillStats,
          activeDifficulty: entry.difficulty,
        }),
      });

      let feedback = "";
      if (response.ok) {
        const data = await response.json();
        feedback = data.feedback;
      } else {
        feedback = generateLocalCoachFeedback(
          entry.score,
          entry.exercise,
          entry.selectedAnswers || {},
          skillStats
        );
      }

      setAdaptiveHistory((prev) => {
        const updated = prev.map((item) => {
          if (item.id === entry.id) {
            return { ...item, coachFeedback: feedback };
          }
          return item;
        });
        localStorage.setItem("tef_adaptive_history", JSON.stringify(updated));
        return updated;
      });

      setActiveHistoryDetail((prev) => {
        if (prev && prev.id === entry.id) {
          return { ...prev, coachFeedback: feedback };
        }
        return prev;
      });

    } catch (error) {
      console.error("AI Coach Historic review failed:", error);
      const fallback = generateLocalCoachFeedback(
        entry.score,
        entry.exercise,
        entry.selectedAnswers || {},
        skillStats
      );
      setAdaptiveHistory((prev) => {
        const updated = prev.map((item) => {
          if (item.id === entry.id) {
            return { ...item, coachFeedback: fallback };
          }
          return item;
        });
        localStorage.setItem("tef_adaptive_history", JSON.stringify(updated));
        return updated;
      });
      setActiveHistoryDetail((prev) => {
        if (prev && prev.id === entry.id) {
          return { ...prev, coachFeedback: fallback };
        }
        return prev;
      });
    } finally {
      setRequestingAICoachForHistoric(null);
    }
  };

  const renderHistoryQuestionsTab = (entry: AdaptiveHistoryEntry) => {
    if (!entry.exercise) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto space-y-4 my-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl flex items-center justify-center mx-auto shadow-2xs">
            <Lock size={20} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800">Données restreintes</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Cette session est pré-chargée à titre d'exemple et ne dispose pas d'analyse détaillée des questions. Réalisez de nouvelles épreuves pour enregistrer l'intégralité de vos réponses !
            </p>
          </div>
          <button
            onClick={() => {
              setActiveHistoryDetail(null);
              setActiveTab("practice");
            }}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition"
          >
            Lancer un nouvel entraînement
          </button>
        </div>
      );
    }

    const ex = entry.exercise;
    const userAnswers = entry.selectedAnswers || {};

    return (
      <div className="space-y-6 text-left max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-display">
            RÉPONSES DE LA SESSION
          </h4>
          <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            Score : {entry.score} / 5 correct
          </span>
        </div>

        <div className="space-y-4">
          {ex.questions.map((q, idx) => {
            const chosen = userAnswers[q.id];
            const isCorrect = chosen === q.correctAnswer;
            const skill = q.skillTested || "Implicit opinion";

            return (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-slate-200/70 p-5 space-y-4 shadow-3xs"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                      Question {idx + 1} • {formatSkillDisplay(skill)}
                    </span>
                    <h5 className="text-sm font-extrabold text-slate-800 leading-snug">
                      {q.questionText}
                    </h5>
                  </div>
                  {chosen ? (
                    isCorrect ? (
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 text-xs font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={13} />
                        Correct
                      </span>
                    ) : (
                      <span className="text-rose-600 bg-rose-50 border border-rose-100 text-xs font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                        <XCircle size={13} />
                        Incorrect
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400 bg-slate-50 border border-slate-200/60 text-xs font-medium px-2.5 py-1 rounded-lg shrink-0">
                      Non répondu
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {q.options.map((opt) => {
                    const isOptionCorrect = opt.key === q.correctAnswer;
                    const isOptionChosen = opt.key === chosen;

                    let bgClass = "bg-slate-50/55 border-slate-100 text-slate-700";
                    let checkIcon = "☐";
                    if (isOptionCorrect) {
                      bgClass = "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium";
                      checkIcon = "☑";
                    } else if (isOptionChosen) {
                      bgClass = "bg-rose-50/60 border-rose-200 text-rose-900 font-medium";
                      checkIcon = "☒";
                    }

                    return (
                      <div
                        key={opt.key}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${bgClass}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-extrabold text-indigo-600/70">{opt.key}.</span>
                          <span>{opt.text}</span>
                        </span>
                        <span className="text-xs font-extrabold opacity-70">{checkIcon}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="p-3 bg-emerald-50/10 border border-emerald-100/40 rounded-lg space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-700 font-extrabold block">
                      Stratégie d'écoute
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {q.why || q.explanation}
                    </p>
                  </div>
                  {q.commonTrap || q.trap ? (
                    <div className="p-3 bg-amber-50/10 border border-amber-100/40 rounded-lg space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-amber-700 font-extrabold block">
                        Piège classique
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {q.commonTrap || q.trap}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHistoryTranscriptTab = (entry: AdaptiveHistoryEntry) => {
    if (!entry.exercise) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto space-y-4 my-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl flex items-center justify-center mx-auto shadow-2xs">
            <Lock size={20} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800">Transcription restreinte</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Les transcriptions complètes ne sont disponibles que pour les sessions réelles enregistrées lors de votre pratique active.
            </p>
          </div>
        </div>
      );
    }

    const dialogue = entry.exercise.dialogue || [];
    
    return (
      <div className="space-y-5 text-left max-w-3xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-display">
            TRANSCRIPTION DE L'ENREGISTREMENT
          </h4>
          <span className="text-xs text-slate-400 font-medium">
            2 interlocuteurs : Sophie & Marc
          </span>
        </div>

        <div className="p-4 bg-indigo-50/45 border border-indigo-100 rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-indigo-900 block leading-tight">
              Réécoute Audio Interactive
            </span>
            <p className="text-[11px] text-slate-500 leading-normal">
              Pour écouter l'enregistrement audio original de Sophie & Marc avec le lecteur interactif, relancez l'épreuve.
            </p>
          </div>
          
          <button
            onClick={() => {
              handleReplaySession(entry);
              setActiveHistoryDetail(null);
            }}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Play size={11} fill="white" />
            Rejouer l'Épreuve
          </button>
        </div>

        <div className="space-y-4">
          {dialogue.map((line, idx) => {
            const isSophie = line.speaker === "Sophie";
            return (
              <div
                key={idx}
                className={`flex gap-3.5 ${isSophie ? "justify-start text-left" : "justify-end text-right"}`}
              >
                {isSophie && (
                  <div className="w-8 h-8 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center font-bold text-rose-700 text-xs shrink-0 mt-1">
                    S
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl max-w-lg shadow-3xs ${
                    isSophie
                      ? "bg-rose-50/50 border border-rose-100/85 text-slate-800 rounded-tl-xs"
                      : "bg-indigo-50/40 border border-indigo-100/70 text-slate-800 rounded-tr-xs"
                  }`}
                >
                  <div className={`text-[10px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5 ${isSophie ? "text-rose-700" : "text-indigo-700"}`}>
                    <span>{line.speaker}</span>
                    {line.emotion && EMOTION_LABELS[line.emotion.toLowerCase()] && (
                      <span
                        className={`text-[8px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md border ${
                          EMOTION_LABELS[line.emotion.toLowerCase()].bg
                        } ${EMOTION_LABELS[line.emotion.toLowerCase()].text} flex items-center gap-1 shadow-2xs`}
                      >
                        <span>{EMOTION_LABELS[line.emotion.toLowerCase()].emoji}</span>
                        <span>{EMOTION_LABELS[line.emotion.toLowerCase()].label}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed text-slate-700">
                    {line.text}
                  </p>
                </div>
                {!isSophie && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs shrink-0 mt-1">
                    M
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHistoryAICoachTab = (entry: AdaptiveHistoryEntry) => {
    const feedback = entry.coachFeedback;

    if (!feedback) {
      if (entry.exercise) {
        const isRequesting = requestingAICoachForHistoric === entry.id;
        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto space-y-4 my-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto shadow-2xs text-lg">
              🎯
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800">Analyse de correction indisponible</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Le Coach IA n'a pas encore analysé cette session. Générez l'analyse maintenant en contactant le moteur d'évaluation adaptative de l'IA !
              </p>
            </div>
            <button
              onClick={() => handleRequestHistoricAICoach(entry)}
              disabled={isRequesting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Sparkles size={14} className={isRequesting ? "animate-spin" : ""} />
              {isRequesting ? "ANALYSE EN COURS..." : "DÉMARRER L'ANALYSE COACH IA"}
            </button>
          </div>
        );
      }

      return (
        <div className="space-y-6 text-left max-w-2xl mx-auto">
          <div className="flex items-center gap-3 bg-indigo-50/60 p-4 border border-indigo-100 rounded-2xl">
            <Brain className="text-indigo-600" size={24} />
            <div>
              <h4 className="font-extrabold text-indigo-900 text-sm">Conseil du Coach de l'Historique</h4>
              <p className="text-slate-600 text-xs mt-0.5">
                Sur la base de votre performance globale estimée à un niveau supérieur à **B2** :
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <h5 className="text-sm font-extrabold text-indigo-600">Forces détectées</h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                - Excellente écoute des **expressions idiomatiques** et de la **concession** orale.<br />
                - Excellente distinction des **distracteurs phonétiques** dans la Section 20-30.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <h5 className="text-sm font-extrabold text-indigo-600">Recommandation Stratégique</h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ciblez la compétence **Double négation** et repérez les moments de concession forte (par exemple : 'Certes, Sophie accepte au départ, mais Marc introduit un obstacle crucial').
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-left max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Sparkles className="text-indigo-600" size={18} />
          <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-display">
            RAPPORT CORRECTIF PERSONNALISÉ (COACH IA)
          </h4>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50/20 rounded-bl-full pointer-events-none" />
          
          <div className="markdown-body text-xs md:text-sm text-slate-700 leading-relaxed space-y-4">
            {renderMarkdown(feedback)}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryDetailsModal = () => {
    if (!activeHistoryDetail) return null;
    const entry = activeHistoryDetail;
    const topicDetails = TOPICS.find((t) => t.id === entry.topic);
    const dateObj = new Date(entry.timestamp);
    const formattedDate = dateObj.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 text-left">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-2xl">
                {topicDetails?.icon || "🎯"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                    {topicDetails?.label || entry.topic}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200/50">
                    Niveau {entry.difficulty}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 font-display mt-0.5">
                  {entry.dialogueTopicSummary || "Évaluation TEF"}
                </h3>
                <p className="text-slate-400 text-xs font-medium">
                  Complété le {formattedDate} • Score de {entry.score}/5 ({entry.estimatedTefScore || getSessionTEFScore(entry.score)} pts TEF)
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setActiveHistoryDetail(null)}
              className="py-1 px-3 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wide transition cursor-pointer self-start md:self-auto"
            >
              Fermer
            </button>
          </div>

          <div className="flex border-b border-slate-200 px-6 bg-white gap-6 shrink-0">
            {(["questions", "transcript", "ai_coach"] as const).map((tab) => {
              const isActive = activeHistoryTab === tab;
              const label =
                tab === "questions"
                  ? "Correction"
                  : tab === "transcript"
                  ? "Transcription Audio"
                  : "Analyse Coach IA";
              const icon =
                tab === "questions" ? (
                  <BookmarkCheck size={14} />
                ) : tab === "transcript" ? (
                  <Languages size={14} />
                ) : (
                  <Sparkles size={14} />
                );

              return (
                <button
                  key={tab}
                  onClick={() => setActiveHistoryTab(tab)}
                  className={`py-3.5 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
            {activeHistoryTab === "questions" && renderHistoryQuestionsTab(entry)}
            {activeHistoryTab === "transcript" && renderHistoryTranscriptTab(entry)}
            {activeHistoryTab === "ai_coach" && renderHistoryAICoachTab(entry)}
          </div>
        </div>
      </div>
    );
  };

  const calculatePredictiveStats = (history: AdaptiveHistoryEntry[], currentSkillStats: { [key: string]: { correct: number; total: number } }) => {
    const last20 = [...history]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-20);

    const numSessions = last20.length;

    if (numSessions === 0) {
      return {
        currentProbability: 45,
        targetProbability: 85,
        confidenceLevel: "Moyenne" as "Faible" | "Moyenne" | "Élevée",
        confidencePercent: 55,
        estimatedSessionsRemaining: 12,
        recommendedWeeklyStudyTime: "4h à 6h par semaine",
        trendDirection: "stable" as "up" | "down" | "stable",
        trendValue: 0,
        consistency: "Moyenne",
        cognitiveMastery: 60,
        questionTypeMastery: {
          "20-30": 65,
          "35-40": 55,
          "mixed": 60,
        },
        sessionsList: [],
      };
    }

    const tefScores = last20.map(s => {
      if (s.estimatedTefScore) return s.estimatedTefScore;
      return getSessionTEFScore(s.score);
    });

    const avgTefScore = tefScores.reduce((sum, score) => sum + score, 0) / numSessions;

    let trendDirection: "up" | "down" | "stable" = "stable";
    let trendValue = 0;
    if (numSessions >= 2) {
      const half = Math.floor(numSessions / 2);
      const firstHalf = tefScores.slice(0, half);
      const secondHalf = tefScores.slice(half);
      const avgFirst = firstHalf.reduce((s, x) => s + x, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, x) => s + x, 0) / secondHalf.length;
      
      trendValue = Math.round(avgSecond - avgFirst);
      if (trendValue > 15) {
        trendDirection = "up";
      } else if (trendValue < -15) {
        trendDirection = "down";
      } else {
        trendDirection = "stable";
      }
    }

    let consistency: "Très élevée" | "Élevée" | "Moyenne" | "Variable" = "Moyenne";
    let standardDeviation = 0;
    if (numSessions >= 2) {
      const mean = avgTefScore;
      const variance = tefScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / numSessions;
      standardDeviation = Math.sqrt(variance);

      if (standardDeviation < 30) {
        consistency = "Très élevée";
      } else if (standardDeviation < 60) {
        consistency = "Élevée";
      } else if (standardDeviation < 100) {
        consistency = "Moyenne";
      } else {
        consistency = "Variable";
      }
    }

    const skillValues = Object.values(currentSkillStats);
    const cognitiveMastery = skillValues.length > 0
      ? Math.round((skillValues.reduce((sum, s) => sum + (s.correct / s.total), 0) / skillValues.length) * 100)
      : 65;

    const qtStats: { [key: string]: { correct: number; total: number } } = {
      "20-30": { correct: 0, total: 0 },
      "35-40": { correct: 0, total: 0 },
      "mixed": { correct: 0, total: 0 },
    };

    last20.forEach(s => {
      const qt = s.questionType || "mixed";
      if (qtStats[qt]) {
        qtStats[qt].correct += s.score;
        qtStats[qt].total += s.total;
      }
    });

    const questionTypeMastery: { [key: string]: number } = {};
    Object.entries(qtStats).forEach(([type, stat]) => {
      questionTypeMastery[type] = stat.total > 0
        ? Math.round((stat.correct / stat.total) * 100)
        : (type === "20-30" ? 70 : type === "35-40" ? 55 : 62);
    });

    let baseProb = 1 / (1 + Math.exp(-(avgTefScore - 380) / 45));
    let currentProbability = Math.round(baseProb * 100);

    if (trendDirection === "up") {
      currentProbability += 8;
    } else if (trendDirection === "down") {
      currentProbability -= 8;
    }

    if (cognitiveMastery > 75) {
      currentProbability += 5;
    } else if (cognitiveMastery < 50) {
      currentProbability -= 8;
    }

    if (consistency === "Variable") {
      currentProbability -= 5;
    } else if (consistency === "Très élevée" && avgTefScore >= 400) {
      currentProbability += 4;
    }

    currentProbability = Math.max(5, Math.min(98, currentProbability));

    let confidencePercent = 30;
    if (numSessions >= 15) confidencePercent = 85;
    else if (numSessions >= 10) confidencePercent = 75;
    else if (numSessions >= 5) confidencePercent = 60;
    else if (numSessions >= 3) confidencePercent = 45;

    if (consistency === "Très élevée" || consistency === "Élevée") {
      confidencePercent += 10;
    } else if (consistency === "Variable") {
      confidencePercent -= 15;
    }
    confidencePercent = Math.max(10, Math.min(95, confidencePercent));

    let confidenceLevel: "Faible" | "Moyenne" | "Élevée" = "Moyenne";
    if (confidencePercent < 45) {
      confidenceLevel = "Faible";
    } else if (confidencePercent > 75) {
      confidenceLevel = "Élevée";
    }

    const targetProbability = 85;
    let estimatedSessionsRemaining = 0;
    if (currentProbability < targetProbability) {
      let progressRatePerSession = 3.0;
      if (trendDirection === "up") progressRatePerSession = 4.5;
      if (trendDirection === "down") progressRatePerSession = 1.5;

      estimatedSessionsRemaining = Math.max(1, Math.round((targetProbability - currentProbability) / progressRatePerSession));
    }

    let recommendedWeeklyStudyTime = "4h à 6h par semaine";
    if (currentProbability >= 85) {
      recommendedWeeklyStudyTime = "2h à 3h par semaine (Maintien)";
    } else if (currentProbability >= 65) {
      recommendedWeeklyStudyTime = "3h à 5h par semaine (Consolidation)";
    } else if (currentProbability >= 45) {
      recommendedWeeklyStudyTime = "5h à 7h par semaine (Entraînement régulier)";
    } else {
      recommendedWeeklyStudyTime = "7h à 10h par semaine (Plan Intensif)";
    }

    const sessionsList = last20.map((s, idx) => ({
      index: idx + 1,
      name: `S${idx + 1}`,
      score: s.score,
      total: s.total,
      tefScore: s.estimatedTefScore || getSessionTEFScore(s.score),
      topic: s.dialogueTopicSummary || s.topic,
      difficulty: s.difficulty,
    }));

    return {
      currentProbability,
      targetProbability,
      confidenceLevel,
      confidencePercent,
      estimatedSessionsRemaining,
      recommendedWeeklyStudyTime,
      trendDirection,
      trendValue,
      consistency,
      cognitiveMastery,
      questionTypeMastery,
      sessionsList,
    };
  };

  const renderPredictionsPage = () => {
    const stats = calculatePredictiveStats(adaptiveHistory, skillStats);

    const isPerfectTrend = stats.trendDirection === "up";
    const isStableTrend = stats.trendDirection === "stable";

    return (
      <div className="max-w-6xl mx-auto space-y-6 w-full py-4 font-sans text-slate-800" id="predictive-dashboard-container">
        {/* Header Title & Intro Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5" id="predictive-header">
          <div className="text-left">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-display flex items-center gap-2" id="predictive-title">
              <TrendingUp className="text-indigo-600 animate-pulse" size={24} />
              Tableau de Bord Prédictif de Réussite (TEF B2)
            </h2>
            <p className="text-slate-500 text-sm mt-1" id="predictive-subtitle">
              Analyse prédictive de votre probabilité d'atteindre le niveau **B2 (400+ points)** à l'épreuve de Compréhension Orale du TEF.
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-medium text-slate-500" id="sessions-count-badge">
            <span>Données analysées : </span>
            <span className="font-extrabold text-indigo-600">{Math.min(20, adaptiveHistory.length)} dernières sessions</span>
          </div>
        </div>

        {/* PRIMARY METRICS BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="primary-metrics-grid">
          {/* Gauge Widget: Current Success Probability */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col items-center justify-between relative overflow-hidden" id="gauge-probability-card">
            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50/15 rounded-bl-full pointer-events-none" />
            
            <div className="text-center w-full">
              <div className="flex items-center justify-center gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                  Probabilité Actuelle B2
                </span>
                <div className="group relative">
                  <HelpCircle size={12} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition z-50 shadow-lg leading-relaxed">
                    Probabilité estimée d'obtenir au moins 400 points (B2) sur la base de vos sessions et de vos acquis.
                  </div>
                </div>
              </div>
              
              <h3 className="text-xs text-slate-400 font-medium mt-0.5">
                Objectif de préparation : {stats.targetProbability}%
              </h3>
            </div>

            {/* Visual Circular Meter */}
            <div className="relative w-44 h-44 flex items-center justify-center my-6" id="probability-radial-container">
              {/* SVG Background and progress ring */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="74"
                  stroke="#f1f5f9"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="74"
                  stroke="url(#probability-gradient)"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={464}
                  strokeDashoffset={464 - (464 * stats.currentProbability) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="probability-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
              </svg>
              
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-slate-900 font-display">
                  {stats.currentProbability}%
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 ${
                  stats.currentProbability >= 85 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : stats.currentProbability >= 65 
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {stats.currentProbability >= 85 ? "Prêt (B2+)" : stats.currentProbability >= 65 ? "En bonne voie" : "En progression"}
                </span>
              </div>
            </div>

            {/* Target Comparison Bar */}
            <div className="w-full space-y-1.5" id="probability-progress-bar-container">
              <div className="flex justify-between text-[11px] font-bold text-slate-400">
                <span>0%</span>
                <span className="text-indigo-600 font-extrabold">Cible : {stats.targetProbability}%</span>
                <span>100%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 relative">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                  style={{ width: `${stats.currentProbability}%` }}
                />
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-rose-500"
                  style={{ left: `${stats.targetProbability}%` }}
                  title="Seuil de réussite cible"
                />
              </div>
            </div>
          </div>

          {/* Sessions Remaining Widget */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between relative overflow-hidden" id="sessions-remaining-card">
            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50/15 rounded-bl-full pointer-events-none" />
            
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                Préparation Estimée
              </span>
              <h3 className="text-xs text-slate-400 font-medium">
                Sessions d'entraînement requises pour atteindre la cible
              </h3>
            </div>

            <div className="my-8 text-center" id="sessions-counter-display">
              {stats.currentProbability >= stats.targetProbability ? (
                <div className="space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-3xs">
                    ✓
                  </div>
                  <h4 className="text-lg font-black text-emerald-700">Aptitudes Validées !</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Votre probabilité actuelle dépasse le seuil de sécurité de {stats.targetProbability}%. Continuez ainsi pour maintenir vos acquis.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-5xl font-black text-slate-900 font-display block">
                    {stats.estimatedSessionsRemaining}
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block">
                    sessions estimées
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-2.5 max-w-xs mx-auto">
                    Nombre estimé de simulations TEF adaptatives à réaliser pour consolider vos compétences critiques et lever les doutes.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-indigo-50/45 border border-indigo-100/60 rounded-xl space-y-1" id="sessions-study-tip">
              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 block">
                Cible d'entraînement
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Priorisez les sessions de type **{stats.currentProbability < 65 ? "Section 20-30" : "Section Mixed"}** à difficulté **{stats.currentProbability < 70 ? "B2" : "C1"}** pour maximiser vos points d'impact.
              </p>
            </div>
          </div>

          {/* Recommended Study Time Widget */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between relative overflow-hidden" id="study-time-card">
            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50/15 rounded-bl-full pointer-events-none" />
            
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                Temps d'Étude Hebdomadaire
              </span>
              <h3 className="text-xs text-slate-400 font-medium">
                Recommandé par notre algorithme adaptatif
              </h3>
            </div>

            <div className="my-6 text-center" id="study-time-display">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-3xs text-xl">
                ⏳
              </div>
              <h4 className="text-xl font-black text-slate-950 font-display">
                {stats.recommendedWeeklyStudyTime}
              </h4>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                Plan de travail hebdomadaire conseillé
              </span>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2 text-left" id="weekly-distribution-plan">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Répartition recommandée
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg">
                  <span className="font-extrabold text-indigo-600 block">60% Écoute</span>
                  <span className="text-slate-500 text-[10px]">Analyse de scripts oraux</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg">
                  <span className="font-extrabold text-indigo-600 block">40% Quiz</span>
                  <span className="text-slate-500 text-[10px]">Épreuves chronométrées</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TREND & CONFIDENCE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="trend-confidence-row">
          {/* Trend Chart Card (2 cols wide on large screens) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs lg:col-span-2 flex flex-col justify-between text-left" id="trend-chart-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 font-display flex items-center gap-2">
                  <LineChart size={16} className="text-indigo-600" />
                  Progression du Score Estimé TEF
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Évolution de l'équivalent de vos points TEF (0-699) sur les 20 dernières sessions.
                </p>
              </div>

              {/* Trend Badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-semibold">Tendance :</span>
                {isPerfectTrend ? (
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    ↗ Positive (+{stats.trendValue} pts)
                  </span>
                ) : isStableTrend ? (
                  <span className="text-xs font-extrabold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    → Stable
                  </span>
                ) : (
                  <span className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    ↘ Volatile ({stats.trendValue} pts)
                  </span>
                )}
              </div>
            </div>

            {/* Recharts Line Chart */}
            <div className="h-64 w-full" id="recharts-line-chart-container">
              {stats.sessionsList.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                  Aucune donnée de session disponible pour générer la courbe de tendance.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart
                    data={stats.sessionsList}
                    margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <YAxis
                      domain={[150, 699]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xl text-left text-xs space-y-1">
                              <p className="font-extrabold text-indigo-300">{data.topic}</p>
                              <p className="font-medium text-slate-300">Difficulté : {data.difficulty}</p>
                              <p className="font-semibold">Score : {data.score}/{data.total} correct</p>
                              <p className="font-black text-indigo-400">Score TEF Est. : {data.tefScore} pts</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* B2 Threshold Line at 400 */}
                    <ReferenceLine
                      y={400}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: "B2 (400 pts)",
                        fill: "#f43f5e",
                        fontSize: 9,
                        fontWeight: "bold",
                        position: "insideTopLeft",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="tefScore"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      dot={{ r: 4, strokeWidth: 1, stroke: "#ffffff" }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Confidence Level & Consistency Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between text-left" id="confidence-consistency-card">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                  Indice de Précision du Modèle
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 font-display mt-0.5">
                  Niveau de Confiance
                </h3>
              </div>

              {/* Confidence Indicator Display */}
              <div className="space-y-2.5" id="confidence-percentage-bar">
                <div className="flex justify-between items-baseline">
                  <span className={`text-xl font-black ${
                    stats.confidenceLevel === "Élevée" 
                      ? "text-emerald-600" 
                      : stats.confidenceLevel === "Moyenne" 
                      ? "text-indigo-600" 
                      : "text-amber-500"
                  }`}>
                    {stats.confidenceLevel}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {stats.confidencePercent}% d'indice de confiance
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      stats.confidenceLevel === "Élevée" 
                        ? "bg-emerald-500" 
                        : stats.confidenceLevel === "Moyenne" 
                        ? "bg-indigo-500" 
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${stats.confidencePercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {stats.confidenceLevel === "Faible" 
                    ? "Peu d'épreuves effectuées. L'indice augmentera après avoir complété au moins 5 nouvelles sessions." 
                    : "L'indice de confiance repose sur la régularité de vos scores et le volume d'historique disponible."}
                </p>
              </div>

              {/* Consistency Metric */}
              <div className="pt-4 border-t border-slate-100 space-y-1" id="consistency-metric-details">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                  Régularité des Performances
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">Homogénéité :</span>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-lg">
                    {stats.consistency}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal mt-1">
                  Une régularité élevée indique des compétences consolidées et un comportement stable le jour du test.
                </p>
              </div>
            </div>

            {/* Disclaimer block (strictly matches requirement) */}
            <div className="p-3 bg-rose-50/50 border border-rose-100/80 rounded-xl text-left mt-4" id="predictive-disclaimer">
              <div className="flex gap-1.5">
                <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">
                  Clause de non-responsabilité
                </span>
              </div>
              <p className="text-[10px] text-rose-700 mt-1 leading-relaxed">
                Ce tableau de bord est un outil d'entraînement basé sur vos données d'écoute. Il s'agit uniquement d'une estimation statistique et non d'une prédiction de score officielle ou garantie pour le véritable examen du TEF.
              </p>
            </div>
          </div>
        </div>

        {/* SUB-SKILL & QUESTION TYPE MASTERY BENTO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="mastery-analysis-row">
          {/* Cognitive Skill Mastery (Bar chart of subskills) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs text-left" id="cognitive-mastery-card">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                Force Cognitive
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 font-display mt-0.5">
                Maîtrise des Compétences d'Écoute
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Aperçu de votre taux de réussite moyen par processus de décodage linguistique.
              </p>
            </div>

            <div className="space-y-4" id="cognitive-skills-bars">
              {(Object.entries(skillStats) as [string, { correct: number; total: number }][]).slice(0, 5).map(([skill, stat]) => {
                const percent = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                return (
                  <div key={skill} className="space-y-1">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-slate-700">{formatSkillDisplay(skill)}</span>
                      <span className="font-black text-indigo-600">{percent}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                      <div
                        className={`h-full rounded-full ${
                          percent >= 75 ? "bg-emerald-500" : percent >= 50 ? "bg-indigo-500" : "bg-amber-400"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Type Mastery (Sections of TEF Listening) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs text-left" id="question-type-mastery-card">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                Format d'Épreuve
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 font-display mt-0.5">
                Performance par Type d'Écoute
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Comparatif de votre maîtrise des formats d'épreuves de Compréhension Orale du TEF.
              </p>
            </div>

            <div className="space-y-5" id="question-type-mastery-details">
              {/* Section 20-30 */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center shrink-0 shadow-3xs text-center">
                  <span className="text-[9px] font-extrabold text-indigo-600 uppercase leading-none">Sec.</span>
                  <span className="text-sm font-black text-slate-800 leading-none mt-1">20-30</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-bold text-slate-700">Messages courts et quotidiens</span>
                    <span className="font-extrabold text-indigo-700">{stats.questionTypeMastery["20-30"]}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${stats.questionTypeMastery["20-30"]}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Repérage d'intentions et avis express de Sophie & Marc.
                  </span>
                </div>
              </div>

              {/* Section 35-40 */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center shrink-0 shadow-3xs text-center">
                  <span className="text-[9px] font-extrabold text-indigo-600 uppercase leading-none">Sec.</span>
                  <span className="text-sm font-black text-slate-800 leading-none mt-1">35-40</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-bold text-slate-700">Chroniques et exposés longs</span>
                    <span className="font-extrabold text-indigo-700">{stats.questionTypeMastery["35-40"]}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${stats.questionTypeMastery["35-40"]}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Double négation, thèses soutenues et arguments complexes.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryPage = () => {
    const sortedHistory = [...adaptiveHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
      <div className="max-w-6xl mx-auto space-y-6 w-full py-4 font-sans">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="text-left">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-display flex items-center gap-2">
              <History className="text-indigo-600" size={24} />
              Historique des Sessions
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Consultez vos évaluations passées, lancez des replays interactifs, révisez les transcriptions orales, et accédez à l'analyse corrective de votre Coach IA.
            </p>
          </div>
          <button
            onClick={handleResetStats}
            disabled={adaptiveHistory.length === 0}
            className="flex items-center gap-2 py-2 px-4 border border-red-200 hover:bg-red-50 disabled:opacity-35 disabled:cursor-not-allowed text-red-600 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shrink-0"
          >
            <Trash2 size={14} />
            Effacer tout l'historique
          </button>
        </div>

        {sortedHistory.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4 my-8">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100 shadow-2xs">
              <History size={32} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Aucun historique trouvé</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Vous n'avez pas encore effectué de sessions d'évaluation. Complétez un quiz d'entraînement pour enregistrer vos performances !
              </p>
            </div>
            <button
              onClick={() => setActiveTab("practice")}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Démarrer ma première épreuve
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedHistory.map((entry) => {
              const dateObj = new Date(entry.timestamp);
              const formattedDate = dateObj.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const formattedTime = dateObj.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const topicDetails = TOPICS.find((t) => t.id === entry.topic);
              const isPerfect = entry.score === 5;
              const formattedDuration = `${Math.floor(entry.elapsedTime / 60)}m ${entry.elapsedTime % 60}s`;

              return (
                <div
                  key={entry.id}
                  id={entry.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-2xs hover:shadow-xs transition duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden group text-left"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isPerfect ? "bg-emerald-500" : entry.score >= 3 ? "bg-indigo-500" : "bg-amber-500"
                    }`}
                  />

                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-3xs shrink-0 mt-0.5">
                      {topicDetails?.icon || "🎯"}
                    </div>
                    <div className="space-y-1 text-left flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                          {topicDetails?.label || entry.topic}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200/50">
                          Niveau {entry.difficulty}
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-full border border-indigo-100/50">
                          {entry.questionType === "mixed" ? "Section Mixte" : `Section ${entry.questionType}`}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 line-clamp-1 leading-tight pr-4">
                        {entry.dialogueTopicSummary || "Sujet d'évaluation TEF"}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formattedDate} à {formattedTime}
                        </span>
                        <span className="text-slate-200">•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formattedDuration}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 md:gap-8 min-w-[280px]">
                    <div className="text-left shrink-0">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                        Performance
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black ${
                            isPerfect ? "text-emerald-600" : entry.score >= 3 ? "text-indigo-600" : "text-amber-500"
                          }`}
                        >
                          {entry.score}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">/ 5</span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                        Score TEF Est.
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-800">
                          {entry.estimatedTefScore || getSessionTEFScore(entry.score)}
                        </span>
                        <span className="text-[10px] font-extrabold text-indigo-600 uppercase">
                          ({entry.score === 5 ? "C1" : entry.score === 4 ? "B2" : entry.score === 3 ? "B1" : "A2"})
                        </span>
                      </div>
                    </div>

                    <div className="text-left max-w-[200px] flex-1">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                        À Travailler
                      </span>
                      {entry.weakSkills.length === 0 ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-black uppercase tracking-wide px-2 py-0.5 rounded-md border border-emerald-100">
                          ★ Parfait
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {entry.weakSkills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-bold px-1.5 py-0.5 rounded-md truncate max-w-[120px]"
                              title={formatSkillDisplay(skill)}
                            >
                              {formatSkillDisplay(skill)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap md:flex-nowrap items-center gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                    <button
                      onClick={() => handleOpenHistoryDetails(entry, "questions")}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-[11px] uppercase tracking-wider transition cursor-pointer"
                    >
                      <Eye size={12} />
                      Correction
                    </button>

                    <button
                      onClick={() => handleOpenHistoryDetails(entry, "ai_coach")}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-50/70 hover:bg-indigo-50 text-indigo-700 border border-indigo-100/50 rounded-xl font-bold text-[11px] uppercase tracking-wider transition cursor-pointer"
                    >
                      <Sparkles size={12} />
                      Coach IA
                    </button>

                    <button
                      onClick={() => handleReplaySession(entry)}
                      disabled={!entry.exercise}
                      title={entry.exercise ? "Relancer cette session" : "Session factice d'historique (audio indisponible)"}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <Play size={11} fill="white" />
                      Rejouer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeHistoryDetail && renderHistoryDetailsModal()}
      </div>
    );
  };

  // Calculate stats
  const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

  // Calculate TEF Listening Score estimation (0–699 scale)
  const getTEFEstimation = () => {
    if (totalQuestions === 0) {
      return {
        score: "—",
        range: "—",
        level: "N/A",
        b1Active: false,
        b2Active: false,
        c1Active: false,
        c2Active: false,
      };
    }

    let scoreVal = 0;
    let rangeVal = "—";
    let levelVal = "B1";
    let b1Active = false;
    let b2Active = false;
    let c1Active = false;
    let c2Active = false;

    // Map current global accuracy to standard TEF 0-699 score ranges:
    // A1: 0–199, A2: 200–299, B1: 300–399, B2: 400–499, C1: 500–599, C2: 600–699
    if (accuracy < 30) {
      const ratio = accuracy / 30;
      scoreVal = Math.round(ratio * 199);
      rangeVal = "0–199";
      levelVal = "A1";
    } else if (accuracy < 50) {
      const ratio = (accuracy - 30) / 20;
      scoreVal = Math.round(200 + ratio * 99);
      rangeVal = "200–299";
      levelVal = "A2";
    } else if (accuracy < 70) {
      const ratio = (accuracy - 50) / 20;
      scoreVal = Math.round(300 + ratio * 99);
      rangeVal = "300–399";
      levelVal = "B1";
      b1Active = true;
    } else if (accuracy < 85) {
      const ratio = (accuracy - 70) / 15;
      scoreVal = Math.round(400 + ratio * 99);
      rangeVal = "400–499";
      levelVal = "B2";
      b2Active = true;
    } else if (accuracy < 95) {
      const ratio = (accuracy - 85) / 10;
      scoreVal = Math.round(500 + ratio * 99);
      rangeVal = "500–599";
      levelVal = "C1";
      c1Active = true;
    } else {
      const ratio = (accuracy - 95) / 5;
      scoreVal = Math.round(600 + ratio * 99);
      if (scoreVal > 699) scoreVal = 699;
      rangeVal = "600–699";
      levelVal = "C2";
      c2Active = true;
    }

    return {
      score: scoreVal,
      range: rangeVal,
      level: levelVal,
      b1Active,
      b2Active,
      c1Active,
      c2Active,
    };
  };

  const tefEstimation = getTEFEstimation();

  // Identify weak topics (Accuracy < 65% and minimum 1 question answered)
  const weakTopics = TOPICS.filter((t) => {
    const stat = topicStats[t.id];
    if (!stat || stat.total === 0) return false;
    const topicAccuracy = (stat.correct / stat.total) * 100;
    return topicAccuracy < 65;
  });

  const successTopics = TOPICS.filter((t) => {
    const stat = topicStats[t.id];
    if (!stat || stat.total === 0) return false;
    const topicAccuracy = (stat.correct / stat.total) * 100;
    return topicAccuracy >= 65;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans flex flex-col">
      {/* HEADER - Professional Polish Style */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
            TEF
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
              Canada Trainer
              <span className="hidden md:inline text-indigo-600 font-normal text-sm border-l border-slate-200 pl-2">
                Listening Comprehension
              </span>
            </h1>
          </div>
        </div>

        {/* Navigation Tabs - Responsive & Professional */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 font-display">
          <button
            onClick={() => {
              setActiveTab("practice");
            }}
            className={`px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "practice"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Compass size={14} />
            <span className="hidden sm:inline">Entraînement</span>
            <span className="sm:hidden">Quiz</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
            }}
            className={`px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "history"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History size={14} />
            <span className="hidden sm:inline">Historique</span>
            <span className="sm:hidden">Hist.</span>
            {adaptiveHistory.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {adaptiveHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("predictions");
            }}
            className={`px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "predictions"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp size={14} />
            <span className="hidden sm:inline">Prédictions B2</span>
            <span className="sm:hidden">Préd.</span>
          </button>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Précision Globale
            </span>
            <span className={`text-base md:text-lg font-extrabold ${accuracy >= 70 ? 'text-emerald-600' : accuracy >= 40 ? 'text-amber-500' : 'text-slate-600'}`}>
              {totalQuestions > 0 ? `${accuracy}%` : "—"}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Sessions
            </span>
            <span className="text-base md:text-lg font-extrabold text-slate-800">
              {totalSessions}
            </span>
          </div>

          <button
            onClick={handleResetStats}
            disabled={totalQuestions === 0}
            title="Réinitialiser l'historique"
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER WITH WORKSPACE SIDEBAR LAYOUT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* SIDEBAR: Configured perfectly as requested */}
        <aside className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto max-h-[600px] lg:max-h-none">
          {/* SESSION Segment */}
          <section className="space-y-4">
            <div className="space-y-2">
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
              <h2 className="text-xs font-bold tracking-widest text-slate-800 font-display text-center uppercase">
                SESSION
              </h2>
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
            </div>

            <div className="space-y-4">
              {/* Difficulty selector list */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level</span>
                <div className="space-y-1">
                  {(["B1", "B2", "C1"] as const).map((lvl) => {
                    const isSelected = difficulty === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setDifficulty(lvl)}
                        className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                          isSelected ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`text-base leading-none ${isSelected ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                            {isSelected ? "☑" : "☐"}
                          </span>
                          <span>{lvl === "B1" ? "B1 (Intermediate)" : lvl === "B2" ? "B2 (Advanced)" : "C1 (Expert)"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questions/Section Selector */}
              <div className="space-y-1 border-t border-slate-100/70 pt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Questions</span>
                <div className="space-y-1">
                  {(["20-30", "35-40", "mixed"] as const).map((type) => {
                    const isSelected = questionType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setQuestionType(type)}
                        className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                          isSelected ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`text-base leading-none ${isSelected ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                            {isSelected ? "☑" : "☐"}
                          </span>
                          <span>
                            {type === "20-30" ? "Questions 20–30 (Short)" : type === "35-40" ? "Questions 35–40 (Long)" : "Mixed Questions"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration selector */}
              <div className="space-y-1 border-t border-slate-100/70 pt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                <div className="space-y-1">
                  {([60, 90, 120] as const).map((len) => {
                    const isSelected = durationSec === len;
                    return (
                      <button
                        key={len}
                        onClick={() => setDurationSec(len)}
                        className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                          isSelected ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`text-base leading-none ${isSelected ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                            {isSelected ? "☑" : "☐"}
                          </span>
                          <span>{len} sec {len === 90 ? "(Standard)" : ""}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* TOPIC Segment */}
          <section className="space-y-3">
            <div className="space-y-2">
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
              <h2 className="text-xs font-bold tracking-widest text-slate-800 font-display text-center uppercase">
                TOPIC
              </h2>
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
            </div>

            <div className="space-y-2">
              {/* Random selection */}
              <button
                onClick={() => setSelectedTopic("random")}
                className={`w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer ${
                  selectedTopic === "random"
                    ? "bg-indigo-600 text-white shadow-sm font-bold"
                    : "text-slate-700 hover:bg-slate-50 border border-slate-100 bg-slate-50/40"
                }`}
              >
                <span className="flex items-center gap-2 w-full">
                  <span className="text-base leading-none">
                    {selectedTopic === "random" ? "☑" : "☐"}
                  </span>
                  <span className="flex items-center justify-between w-full">
                    <span>Génération Adaptative</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                      selectedTopic === "random" ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600"
                    }`}>
                      🎯 IA
                    </span>
                  </span>
                </span>
              </button>

              <div className="text-center text-[9px] font-extrabold text-slate-400 uppercase tracking-widest py-1 flex items-center justify-center gap-2">
                <span className="w-6 border-b border-slate-200"></span>
                <span>or select category</span>
                <span className="w-6 border-b border-slate-200"></span>
              </div>

              {/* Specific Topics */}
              <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {TOPICS.map((t) => {
                  const isSelected = selectedTopic === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTopic(t.id)}
                      className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                          : "text-slate-600 hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-base leading-none ${isSelected ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                          {isSelected ? "☑" : "☐"}
                        </span>
                        <span>{t.icon} {t.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* MODE DE SIMULATION Segment */}
          <section className="space-y-3">
            <div className="space-y-2">
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
              <h2 className="text-xs font-bold tracking-widest text-slate-800 font-display text-center uppercase">
                MODE DE SIMULATION
              </h2>
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
            </div>

            <div className="space-y-1">
              {/* Practice Mode toggle */}
              <button
                onClick={() => {
                  setExamMode(false);
                }}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base leading-none ${!examMode ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                    {!examMode ? "☑" : "☐"}
                  </span>
                  <span>Practice Mode</span>
                </span>
              </button>

              {/* Exam Mode toggle */}
              <button
                onClick={() => {
                  setExamMode(true);
                  setHideTranscript(true);
                }}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base leading-none ${examMode ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                    {examMode ? "☑" : "☐"}
                  </span>
                  <span>Exam Mode</span>
                </span>
              </button>
            </div>
          </section>

          {/* OPTIONS Segment */}
          <section className="space-y-3">
            <div className="space-y-2">
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
              <h2 className="text-xs font-bold tracking-widest text-slate-800 font-display text-center uppercase">
                OPTIONS
              </h2>
              <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs">━━━━━━━━━━━━━━━━━━</span>
            </div>

            <div className="space-y-1">
              {/* Hide Transcript toggle */}
              <button
                onClick={() => !examMode && setHideTranscript(!hideTranscript)}
                disabled={examMode}
                className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition text-left ${examMode ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base leading-none ${hideTranscript ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                    {hideTranscript ? "☑" : "☐"}
                  </span>
                  <span>Hide Transcript</span>
                </span>
                {examMode && <span className="text-[9px] font-bold text-indigo-500 uppercase">Exam Active</span>}
              </button>

              {/* Random Voices toggle */}
              <button
                onClick={() => setRandomVoices(!randomVoices)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base leading-none ${randomVoices ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                    {randomVoices ? "☑" : "☐"}
                  </span>
                  <span>Random Voices</span>
                </span>
              </button>

              {/* Show Score toggle */}
              <button
                onClick={() => setShowScore(!showScore)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base leading-none ${showScore ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                    {showScore ? "☑" : "☐"}
                  </span>
                  <span>Show Score</span>
                </span>
              </button>

              {/* Save Session toggle */}
              <button
                onClick={() => setSaveSession(!saveSession)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base leading-none ${saveSession ? "text-indigo-600 font-bold" : "text-slate-300"}`}>
                    {saveSession ? "☑" : "☐"}
                  </span>
                  <span>Save Session</span>
                </span>
              </button>
            </div>
          </section>

          {/* START / Action Button */}
          <div className="pt-2 mt-auto">
            <span className="text-slate-300 block text-center font-mono leading-none tracking-widest text-xs mb-3">━━━━━━━━━━━━━━━━━━</span>
            <button
              onClick={handleGenerateExercise}
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-md shadow-indigo-100 hover:shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles size={16} />
              {loading ? "GENERATING..." : "START"}
            </button>
          </div>
        </aside>

        {/* RIGHT AREA: Active Test Center / Questionnaire */}
        <section className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto bg-slate-50">
          {activeTab === "history" ? (
            renderHistoryPage()
          ) : activeTab === "predictions" ? (
            renderPredictionsPage()
          ) : !exercise && !loading ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-6 w-full py-4"
            >
              {/* Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 bg-[#eef2ff] text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
                    <Languages size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 font-display">
                      Votre Espace d'Entraînement TEF Canada
                    </h2>
                    <p className="text-slate-500 text-xs md:text-sm mt-0.5 leading-relaxed max-w-lg">
                      Analyse de performance en temps réel propulsée par Gemini. Préparez-vous de manière ciblée en travaillant vos points d'écoute faibles.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleGenerateExercise}
                  id="generate-conversation-btn"
                  className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Sparkles size={14} />
                  Démarrer l'Épreuve
                </button>
              </div>

              {/* Daily Mission Panel */}
              <div id="daily-mission-panel" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs relative overflow-hidden flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
                      <Target size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900 font-display">
                          Today's Objective
                        </h3>
                        <span className="text-[9px] bg-rose-50 text-rose-600 font-black uppercase px-2 py-0.5 rounded-full border border-rose-100 animate-pulse">
                          Quotidien
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Accomplissez cette mission pour valider vos objectifs d'apprentissage du jour.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-mono bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 self-start md:self-auto">
                    <Calendar size={13} className="text-slate-400" />
                    <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Question Type */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between hover:bg-slate-50/80 transition-all">
                    <div className="flex items-center gap-2 text-slate-400">
                      <BookOpen size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-display">Question Segment</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 mt-2 block">
                      Questions {dailyMission.questionType === "20-30" ? "20–30" : "35–40"}
                    </span>
                  </div>

                  {/* Topic */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between hover:bg-slate-50/80 transition-all">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Home size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-display">Sujet / Topic</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 mt-2 block capitalize">
                      {dailyMission.topicLabel}
                    </span>
                  </div>

                  {/* Audio Duration */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between hover:bg-slate-50/80 transition-all">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-display">Audio Duration</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 mt-2 block">
                      {dailyMission.durationSec} seconds
                    </span>
                  </div>

                  {/* Target Skill */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between hover:bg-slate-50/80 transition-all col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Compass size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-display">Target Skill</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 mt-2 block">
                      {formatSkillDisplay(dailyMission.targetSkill)}
                    </span>
                  </div>

                  {/* Estimated Completion */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between hover:bg-slate-50/80 transition-all col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Hourglass size={15} />
                      <span className="text-[10px] font-bold uppercase tracking-wider font-display">Est. Completion</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 mt-2 block">
                      {dailyMission.estimatedCompletionMin} minutes
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Updates automatically every day • Deterministic daily rotation</span>
                  </div>
                  <button
                    onClick={() => handleGenerateExercise({
                      topic: dailyMission.topicId,
                      difficulty: dailyMission.difficulty,
                      questionType: dailyMission.questionType,
                      durationSec: dailyMission.durationSec,
                      isDaily: true
                    })}
                    disabled={loading}
                    className="w-full sm:w-auto py-3 px-6 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-100 hover:shadow-lg hover:shadow-rose-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Sparkles size={14} />
                    {loading ? "GENERATING..." : "Start Session"}
                  </button>
                </div>
              </div>

              {/* Dynamic Auto-Adaptive Difficulty Status Dashboard */}
              <div id="adaptive-difficulty-dashboard" className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-900/60 p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
                      <Cpu size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wider text-white font-display">
                          Moteur d'Adaptation de Difficulté Dynamique
                        </h3>
                        <span className="text-[8px] bg-indigo-500/20 text-indigo-300 font-extrabold uppercase px-2 py-0.5 rounded-full border border-indigo-500/30">
                          Active Adaptation
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Ajuste automatiquement les paramètres de l'oral en fonction de vos scores (Seuil de progression : ≥ 90%).
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 self-start md:self-auto flex items-center gap-1.5">
                    <Sparkles size={11} className="text-indigo-400" />
                    <span>Objectif B2 maintenu en cas de baisse</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  {/* Dialogue Complexity */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/8 transition-all relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block font-display">
                        Complexité Dialogue
                      </span>
                      <span className="text-base font-black text-white block capitalize">
                        {dialogueComplexity === "standard" ? "Standard (B2)" : dialogueComplexity === "complex" ? "Haute (B2+)" : "Extrême (C1-like)"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <div className={`w-3 h-1.5 rounded-xs ${dialogueComplexity === "standard" || dialogueComplexity === "complex" || dialogueComplexity === "highly-complex" ? "bg-indigo-500" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${dialogueComplexity === "complex" || dialogueComplexity === "highly-complex" ? "bg-indigo-400" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${dialogueComplexity === "highly-complex" ? "bg-indigo-300" : "bg-white/10"}`} />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                        {dialogueComplexity === "standard" ? "Niv 1" : dialogueComplexity === "complex" ? "Niv 2" : "Niv 3"}
                      </span>
                    </div>
                  </div>

                  {/* Vocabulary Richness */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/8 transition-all relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block font-display">
                        Richesse Vocabulaire
                      </span>
                      <span className="text-base font-black text-white block capitalize">
                        {vocabularyLevel === "standard" ? "Standard (B2)" : vocabularyLevel === "advanced" ? "Avancé (B2+)" : "Très Avancé (C1)"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <div className={`w-3 h-1.5 rounded-xs ${vocabularyLevel === "standard" || vocabularyLevel === "advanced" || vocabularyLevel === "highly-advanced" ? "bg-indigo-500" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${vocabularyLevel === "advanced" || vocabularyLevel === "highly-advanced" ? "bg-indigo-400" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${vocabularyLevel === "highly-advanced" ? "bg-indigo-300" : "bg-white/10"}`} />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                        {vocabularyLevel === "standard" ? "Niv 1" : vocabularyLevel === "advanced" ? "Niv 2" : "Niv 3"}
                      </span>
                    </div>
                  </div>

                  {/* Implied Meaning */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/8 transition-all relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block font-display">
                        Sens Implicite
                      </span>
                      <span className="text-base font-black text-white block capitalize">
                        {impliedMeaningIntensity === "standard" ? "Standard (B2)" : impliedMeaningIntensity === "subtle" ? "Subtil (B2+)" : "Très Subtil (C1)"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <div className={`w-3 h-1.5 rounded-xs ${impliedMeaningIntensity === "standard" || impliedMeaningIntensity === "subtle" || impliedMeaningIntensity === "highly-subtle" ? "bg-indigo-500" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${impliedMeaningIntensity === "subtle" || impliedMeaningIntensity === "highly-subtle" ? "bg-indigo-400" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${impliedMeaningIntensity === "highly-subtle" ? "bg-indigo-300" : "bg-white/10"}`} />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                        {impliedMeaningIntensity === "standard" ? "Niv 1" : impliedMeaningIntensity === "subtle" ? "Niv 2" : "Niv 3"}
                      </span>
                    </div>
                  </div>

                  {/* Speech Speed */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:bg-white/8 transition-all relative overflow-hidden">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block font-display">
                        Vitesse de Parole
                      </span>
                      <span className="text-base font-black text-white block capitalize">
                        {speechSpeedModifier === "normal" ? "Standard (1.0x)" : speechSpeedModifier === "fast" ? "Rapide (1.1x)" : "Très Rapide (1.2x)"}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <div className={`w-3 h-1.5 rounded-xs ${speechSpeedModifier === "normal" || speechSpeedModifier === "fast" || speechSpeedModifier === "very-fast" ? "bg-indigo-500" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${speechSpeedModifier === "fast" || speechSpeedModifier === "very-fast" ? "bg-indigo-400" : "bg-white/10"}`} />
                        <div className={`w-3 h-1.5 rounded-xs ${speechSpeedModifier === "very-fast" ? "bg-indigo-300" : "bg-white/10"}`} />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                        {speechSpeedModifier === "normal" ? "1.0x" : speechSpeedModifier === "fast" ? "1.1x" : "1.2x"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase 7 Statistics Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Today Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block font-display">
                      Today
                    </span>
                    <span className="text-4xl font-black text-indigo-600 font-display mt-2 block">
                      {todayStats.total > 0 ? `${Math.round((todayStats.correct / todayStats.total) * 100)}%` : "80%"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] text-slate-400 font-medium">Session d'aujourd'hui</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded">
                      {todayStats.correct} / {todayStats.total} réponses
                    </span>
                  </div>
                </div>

                {/* This Week Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block font-display">
                      This week
                    </span>
                    <span className="text-4xl font-black text-indigo-600 font-display mt-2 block">
                      {weekStats.total > 0 ? `${Math.round((weekStats.correct / weekStats.total) * 100)}%` : "84%"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] text-slate-400 font-medium">Cumul de la semaine</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded">
                      {weekStats.correct} / {weekStats.total} réponses
                    </span>
                  </div>
                </div>

                {/* Average Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block font-display">
                      Average
                    </span>
                    <span className="text-4xl font-black text-indigo-600 font-display mt-2 block">
                      {totalQuestions > 0 ? `${Math.round((correctQuestions / totalQuestions) * 100)}%` : "81%"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] text-slate-400 font-medium">Précision historique globale</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded">
                      {correctQuestions} / {totalQuestions} questions
                    </span>
                  </div>
                </div>

                {/* Estimated TEF Score Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block font-display">
                      Estimated Listening Score
                    </span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-4xl font-black text-indigo-600 font-display">
                        {tefEstimation.score}
                      </span>
                      {totalQuestions > 0 && (
                        <span className="text-xs text-slate-400 font-extrabold font-mono">/699</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Range
                      </span>
                      <span className="text-xs font-mono font-extrabold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        {tefEstimation.range}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Estimated Level
                      </span>
                      <div className="flex gap-1.5">
                        {(["B1", "B2", "C1", "C2"] as const).map((lvl) => {
                          const isActive = tefEstimation.level === lvl || (lvl === "B1" && tefEstimation.b1Active) || (lvl === "B2" && tefEstimation.b2Active) || (lvl === "C1" && tefEstimation.c1Active) || (lvl === "C2" && tefEstimation.c2Active);
                          return (
                            <span
                              key={lvl}
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                                isActive
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                  : "bg-slate-50 border-slate-100 text-slate-400"
                              }`}
                            >
                              {lvl}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[9px] text-slate-400 leading-tight border-t border-slate-50 pt-2 flex items-start gap-1">
                    <span className="text-indigo-500 font-bold">ℹ</span>
                    <span>This estimation improves continuously as more training sessions are completed.</span>
                  </div>
                </div>
              </div>

              {/* Improvement Curve Panel (Display improvement over time) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-left">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider font-display flex items-center gap-2">
                    📈 Courbe de Progression (Évolution du Score)
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Historique de maîtrise et amélioration de votre précision d'écoute globale au fil des sessions.
                  </p>
                </div>
                <ImprovementChart data={historicalMastery} />
              </div>

              {/* Sub-skills competency list & recommendations */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* Skills competency breakdown */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider font-display">
                      🎯 Compétences Cognitives TEF Canada
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Détectées d'après votre historique de réponses et de pièges surmontés.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {(Object.entries(skillStats) as [string, { correct: number; total: number }][]).map(([skillName, stat]) => {
                      const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
                      const isWeak = pct < 65;

                      return (
                        <div key={skillName} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                              <span>
                                {skillName === "Implicit opinion" ? "🗣️" :
                                 skillName === "Explicit information" ? "📄" :
                                 skillName === "Speaker intention" ? "🎯" :
                                 skillName === "Recommendation" ? "💡" :
                                 skillName === "Concession" ? "⚖️" :
                                 skillName === "Negation" ? "🚫" :
                                 skillName === "Double negation" ? "🔄" :
                                 skillName === "Inference" ? "🕵️" :
                                 skillName === "Purpose" ? "🥅" :
                                 skillName === "Attitude" ? "🎭" : "🔄"}
                              </span>
                              <span>{skillName}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider ${
                                isWeak 
                                  ? "bg-red-50 text-red-600 border border-red-100" 
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {isWeak ? "Point faible" : "Maîtrisé"}
                              </span>
                              <span className={`font-black font-display ${isWeak ? "text-red-500" : "text-emerald-600"}`}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                          {/* Beautiful Progress Bar */}
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8 }}
                              className={`h-full rounded-full ${
                                isWeak 
                                  ? "bg-red-500" 
                                  : "bg-emerald-500"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recommendations and Tips */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider font-display">
                        📢 Recommandations Pédagogiques
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Conseils d'analyse pour déjouer les pièges auditifs.
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      {/* Dynamic advice based on weakest area */}
                      {(() => {
                        const sortedSkills = (Object.entries(skillStats) as [string, { correct: number; total: number }][]).sort((a, b) => {
                          const pctA = a[1].total > 0 ? (a[1].correct / a[1].total) : 0;
                          const pctB = b[1].total > 0 ? (b[1].correct / b[1].total) : 0;
                          return pctA - pctB;
                        });
                        const weakest = sortedSkills[0];

                        if (weakest) {
                          const [name] = weakest;
                          return (
                            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-1.5">
                              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block font-display">
                                Axe prioritaire : {name}
                              </span>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {name === "Double negation" && "La double négation est votre principal piège auditif. En français oral, accumuler deux négations (ex: 'Ce n'est pas impossible') équivaut à une affirmation. Notez la tournure mentale pour ne pas sur-interpréter l'objection."}
                                {name === "Concession" && "Prêtez attention aux connecteurs d'opposition et de restriction comme 'pourtant', 'néanmoins', 'bien que' ou 'quand bien même'. Ils indiquent qu'un argument de départ va être atténué ou nuancé."}
                                {name === "Implicit opinion" && "Ne cherchez pas des mots simples comme 'j'aime' ou 'je déteste'. Écoutez l'intonation (soupirs, rires, sarcasme) et les figures de style ironiques du locuteur."}
                                {name === "Negation" && "Faites attention aux négations complexes ('ne... guère', 'ne... que', 'sans nul doute'). Le TEF les utilise souvent pour renverser complètement le sens d'un argument à la dernière seconde."}
                                {name === "Recommendation" && "Les tournures de conseils et recommandations utilisent souvent le subjonctif ou le conditionnel présent ('il conviendrait de', 'il faudrait que'). Préparez vos oreilles à ces structures."}
                                {name === "Explicit information" && "Pour les informations explicites, restez concentré sur les faits purs, chiffres, dates ou détails directs énoncés, sans chercher à sur-interpréter ou déduire des conclusions."}
                                {name === "Speaker intention" && "L'intention du locuteur requiert d'identifier pourquoi il parle (convaincre, s'excuser, contredire, informer). Prêtez attention aux actes de parole du dialogue."}
                                {name === "Inference" && "L'inférence demande de lire entre les lignes. Connectez différents indices et faits entendus pour déduire la conclusion logique non formulée explicitement."}
                                {name === "Purpose" && "Pour le but ou l'objectif, identifiez le problème initial posé par Sophie ou Marc. Le but principal est souvent résumé dans les premières secondes de l'enregistrement."}
                                {name === "Attitude" && "L'attitude révèle l'état émotionnel (déception, enthousiasme, hésitation, scepticisme). Soyez attentif à l'intensité de la voix et aux interjections."}
                                {name === "Opinion change" && "Le changement d'opinion est un piège classique du TEF. Un locuteur commence souvent par approuver puis, face à un contre-argument, finit par changer d'avis."}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-display">
                          Méthodologie TEF Canada
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          La correction raisonnée et l'explication logique du simulateur sont conçues pour cibler la compréhension auditive globale et non la grammaire formelle brute.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4 flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-bold">Performance Global Score :</span>
                    <span className="text-[10px] font-black text-slate-600 font-display">
                      {totalSessions > 0 ? `${Math.round((correctQuestions / (totalSessions * 5)) * 100)}% accuracy / session` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adaptive Generation & History Log */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider font-display flex items-center gap-2">
                      🔄 Historique d'Apprentissage Adaptatif (IA)
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Sessions d'écoute ciblées générées d'après l'analyse de vos faiblesses.
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md">
                    Mode Adaptatif Actif 🎯
                  </span>
                </div>

                {adaptiveHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Aucune session adaptative enregistrée pour le moment. Réalisez votre première épreuve !
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Thème & Scénario</th>
                          <th className="py-2.5 px-3">Niveau</th>
                          <th className="py-2.5 px-3">Section</th>
                          <th className="py-2.5 px-3 text-center">Score</th>
                          <th className="py-2.5 px-3">Points ciblés</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {adaptiveHistory.slice().reverse().map((session) => (
                          <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {new Date(session.timestamp).toLocaleDateString("fr-FR", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 capitalize flex items-center gap-1.5">
                                <span>
                                  {session.topic === "work" ? "💼" :
                                   session.topic === "housing" ? "🏠" :
                                   session.topic === "shopping" ? "🛒" :
                                   session.topic === "travel" ? "✈️" :
                                   session.topic === "technology" ? "💻" :
                                   session.topic === "health" ? "🏥" : "🌱"}
                                </span>
                                <span>{session.topic}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-sm">
                                {session.dialogueTopicSummary}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-700">{session.difficulty}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                              {session.questionType === "20-30" ? "Sec. B/C (20-30)" :
                               session.questionType === "35-40" ? "Sec. D (35-40)" : "Mixte (20-40)"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block font-black px-2 py-0.5 rounded text-[11px] font-mono ${
                                session.score >= 4 ? "bg-emerald-50 text-emerald-700 font-bold" :
                                session.score >= 3 ? "bg-amber-50 text-amber-700 font-bold" :
                                "bg-red-50 text-red-700 font-bold"
                              }`}>
                                {session.score} / {session.total}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {session.weakSkills.length === 0 ? (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded">
                                  Sans erreur ✨
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {session.weakSkills.map((sk) => (
                                    <span key={sk} className="text-[9px] font-bold text-red-600 bg-red-50/50 px-1.5 py-0.5 rounded">
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          ) : loading ? (
            /* Loading Tips Carousel in main screen as well for perfect layout integration */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 shadow-xs max-w-2xl mx-auto my-auto text-center"
            >
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 font-display mb-1">
                Conception de l'enregistrement de l'examen...
              </h3>
              <p className="text-xs text-slate-400 mb-6 animate-pulse">
                Génération du dialogue {difficulty} ({questionType === "mixed" ? "Mixte 20-40" : `Section ${questionType}`} • {durationSec}s) & Modulations TTS.
              </p>

              {/* Sequential AI Pipeline Checklist */}
              <div className="mb-8 max-w-xs mx-auto text-left space-y-2 border-t border-b border-slate-100 py-4">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${generationStep === "conversation" ? "bg-indigo-600 animate-pulse" : "bg-emerald-500"}`}></span>
                  <span className={generationStep === "conversation" ? "font-bold text-slate-800" : "text-slate-400"}>
                    1. AI Conversation Generator {generationStep !== "conversation" ? "✓" : "(En cours...)"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${generationStep === "questions" ? "bg-indigo-600 animate-pulse" : (generationStep === "audio" || generationStep === "idle") ? "bg-emerald-500" : "bg-slate-200"}`}></span>
                  <span className={generationStep === "questions" ? "font-bold text-slate-800" : "text-slate-400"}>
                    2. AI Question Generator {(generationStep === "audio" || generationStep === "idle") ? "✓" : generationStep === "questions" ? "(En cours...)" : "(En attente)"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${generationStep === "audio" ? "bg-indigo-600 animate-pulse" : "bg-slate-200"}`}></span>
                  <span className={generationStep === "audio" ? "font-bold text-slate-800" : "text-slate-400"}>
                    3. AI Voice Synthesis {generationStep === "audio" ? "(En cours...)" : (generationStep === "idle" && exercise) ? "✓" : "(En attente)"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                  <span className="text-slate-400 font-medium">
                    4. Scoring Engine & Coach (Prêt)
                  </span>
                </div>
              </div>

              <div className="p-5 bg-indigo-50/55 border border-indigo-100 rounded-xl text-left max-w-md mx-auto flex gap-3.5">
                <div className="p-2 bg-white text-indigo-600 rounded-lg shadow-xs shrink-0 h-8 w-8 flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                    CONSEIL TEF CANADA
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {LOADING_TIPS[loadingTipIndex]}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : exercise && (
            /* ACTIVE EXERCISE OR FINISHED SCREEN */
            <div className="space-y-6">
              {/* TEF Simulation Mode Banner */}
              {examMode && (
                <div id="tef-simulation-banner" className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>TEF Simulation Mode</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-amber-600 animate-pulse" />
                    <span className="font-mono text-xs font-extrabold normal-case tracking-normal">
                      Elapsed: {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>
              )}

              {/* Top Questions bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 font-display">
                    {quizFinished ? "Correction de l'épreuve" : "Épreuve active"}{" "}
                    {isDailyMissionSession && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-rose-100 ml-1.5 shadow-xs align-middle">
                        🎯 Mission du Jour
                      </span>
                    )}{" "}
                    <span className="text-indigo-600 font-normal">({exercise.questions.length} questions)</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Compréhension de l'oral • Niveau {activeDifficulty} • Section {activeQuestionType === "mixed" ? "Mixed (20-40)" : activeQuestionType}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!examMode && (
                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-500 font-bold text-xs" title="Temps écoulé">
                      <Clock size={12} />
                      <span className="font-mono text-[11px]">{formatTime(elapsedTime)}</span>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                  {exercise.questions.map((_, idx) => {
                    const qId = exercise.questions[idx].id;
                    const chosen = selectedAnswers[qId];
                    const correct = chosen === exercise.questions[idx].correctAnswer;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition cursor-pointer ${
                          idx === currentQuestionIndex
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 ring-2 ring-indigo-100"
                            : quizFinished
                            ? correct
                              ? "bg-emerald-500 text-white"
                              : "bg-red-500 text-white"
                            : chosen
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>

              {/* AUDIO PLAYER: Integrates the player beautifully in the center of the active test space */}
              <div className="bg-[#121212] rounded-2xl border border-zinc-800 p-6 shadow-2xl space-y-5 text-white">
                {audioUrl && (
                  <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} />
                )}

                {loadingAudio ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                    <div className="w-8 h-8 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-xs font-bold text-[#1db954] animate-pulse">SYNTHÈSE VOCALE ACTIVE...</span>
                    <span className="text-[10px] text-zinc-400 mt-1">Préparation du dialogue de Sophie & Marc</span>
                  </div>
                ) : (!audioUrl && !isWebSpeechFallback) ? (
                  <div className="py-6 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                    <span className="text-xs text-amber-500 font-semibold">Génération audio non initiée</span>
                    <p className="text-[10px] text-zinc-500 mt-1">Cliquez sur START à gauche pour lancer la simulation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header: Status & Info */}
                    <div className="flex items-center justify-between text-zinc-100 font-display">
                      <div className="flex items-center gap-2">
                        <span className={`${isWebSpeechFallback ? 'text-amber-500' : 'text-[#1db954]'} font-bold text-sm animate-pulse`}>●</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isWebSpeechFallback ? 'text-amber-500' : 'text-[#1db954]'}`}>
                          {isWebSpeechFallback ? "VOIX DE SECOURS ACTIVE (WEB SPEECH)" : "CONVERSATION AUDIO"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-semibold bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/50">
                        Sophie & Marc (TEF {activeDifficulty})
                      </div>
                    </div>

                    {/* ▶ Conversation Title */}
                    <div className="text-center py-0.5">
                      <span className="text-base sm:text-lg font-extrabold tracking-wider text-white flex items-center justify-center gap-2">
                        {isPlaying ? "⏸" : "▶"} Conversation
                      </span>
                    </div>

                    {/* ████████░░░░░░░░░ ASCII progress bar */}
                    <div className="py-1 text-center">
                      <span className="font-mono text-lg sm:text-xl text-[#1db954] tracking-widest font-bold block select-none drop-shadow-[0_0_8px_rgba(29,185,84,0.25)]">
                        {getBlockProgressBar()}
                      </span>
                    </div>

                    {/* 01:12 / 01:31 Timer */}
                    <div className="text-center">
                      <span className="font-mono text-xs text-zinc-400 font-extrabold tracking-widest bg-zinc-800/40 px-3 py-1 rounded-full border border-zinc-800/50">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Smooth seek timeline */}
                    <div className="px-1 pt-1">
                      <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer transition focus:outline-none"
                        style={{
                          background: `linear-gradient(to right, #1db954 0%, #1db954 ${(duration ? (currentTime / duration) * 100 : 0)}%, #27272a ${(duration ? (currentTime / duration) * 100 : 0)}%, #27272a 100%)`
                        }}
                      />
                    </div>

                    {/* ◀ 10s   ▶   10s ▶ Row */}
                    <div className="flex items-center justify-center gap-6 py-1">
                      <button
                        onClick={skipBackward}
                        className="text-xs font-bold text-zinc-400 hover:text-white transition-all active:scale-90 cursor-pointer bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/40 px-3 py-1.5 rounded-full flex items-center gap-1"
                        title="Reculer de 10s"
                      >
                        ◀ 10s
                      </button>

                      <button
                        onClick={togglePlay}
                        className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black shadow-lg hover:shadow-[#1db954]/20 flex items-center justify-center active:scale-95 hover:scale-105 transition duration-200 cursor-pointer"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <span className="text-xl font-bold leading-none select-none">⏸</span>
                        ) : (
                          <span className="text-xl font-bold leading-none select-none ml-0.5">▶</span>
                        )}
                      </button>

                      <button
                        onClick={skipForward}
                        className="text-xs font-bold text-zinc-400 hover:text-white transition-all active:scale-90 cursor-pointer bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/40 px-3 py-1.5 rounded-full flex items-center gap-1"
                        title="Avancer de 10s"
                      >
                        10s ▶
                      </button>
                    </div>

                    {/* 0.9x   1.0x   1.1x speed buttons */}
                    <div className="flex items-center justify-center gap-4 pt-3 border-t border-zinc-800/60">
                      {([0.9, 1.0, 1.1] as const).map((rate) => {
                        const isSelected = playbackRate === rate;
                        return (
                          <button
                            key={rate}
                            onClick={() => setPlaybackRate(rate)}
                            className={`px-3 py-1 text-xs font-black rounded-full transition-all duration-200 ${
                              isSelected
                                ? "bg-[#1db954] text-black shadow-md font-extrabold scale-105"
                                : "bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                            }`}
                          >
                            {rate.toFixed(1)}x
                          </button>
                        );
                      })}
                    </div>

                    {/* Minimalist volume controller */}
                    <div className="flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-400 transition duration-200 text-[10px] font-semibold pt-1">
                      <button
                        onClick={toggleMute}
                        className="p-1 hover:text-[#1db954] transition cursor-pointer"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted || volume === 0 ? "🔇" : "🔊"}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1.5 rounded-lg appearance-none cursor-pointer transition focus:outline-none"
                        style={{
                          background: `linear-gradient(to right, #1db954 0%, #1db954 ${(isMuted ? 0 : volume) * 100}%, #27272a ${(isMuted ? 0 : volume) * 100}%, #27272a 100%)`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TRANSCRIPT POP-OUT ACCESS OR LOCK OVERLAY */}
              {quizFinished || !examMode ? (
                <>
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 font-display">
                          {quizFinished ? "Transcription de l'enregistrement (Déverrouillée)" : "Transcription (Practice Mode)"}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {quizFinished ? "Analysez l'échange pour repérer les nuances, hésitations et changements d'opinion." : "En mode entraînement, vous pouvez consulter le script de l'écoute."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                    >
                      {showTranscript ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showTranscript ? "Masquer la transcription" : "Afficher la transcription"}
                    </button>
                  </div>

                  {/* TRANSCRIPT EXPANDED */}
                  <AnimatePresence>
                    {showTranscript && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden bg-white rounded-2xl border border-slate-200"
                      >
                        <div className="p-5 space-y-3.5 max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50/50">
                          {exercise.dialogue.map((line, idx) => {
                            const isSophie = line.speaker === "Sophie";
                            return (
                              <div
                                key={idx}
                                className={`flex flex-col ${isSophie ? "items-end" : "items-start"}`}
                              >
                                <div className={`flex items-center gap-2 mb-1 ${isSophie ? "flex-row-reverse" : "flex-row"}`}>
                                  <span
                                    className={`text-[10px] font-bold tracking-wider uppercase ${
                                      isSophie ? "text-pink-600" : "text-blue-600"
                                    }`}
                                  >
                                    {isSophie ? "Sophie 👩‍💼" : "Marc 👨‍💼"}
                                  </span>
                                  {line.emotion && EMOTION_LABELS[line.emotion.toLowerCase()] && (
                                    <span
                                      className={`text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md border ${
                                        EMOTION_LABELS[line.emotion.toLowerCase()].bg
                                      } ${EMOTION_LABELS[line.emotion.toLowerCase()].text} flex items-center gap-1 shadow-2xs`}
                                    >
                                      <span>{EMOTION_LABELS[line.emotion.toLowerCase()].emoji}</span>
                                      <span>{EMOTION_LABELS[line.emotion.toLowerCase()].label}</span>
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`p-3.5 max-w-[85%] rounded-2xl text-xs leading-relaxed shadow-xs ${
                                    isSophie
                                      ? "bg-pink-50/70 text-slate-800 rounded-tr-none border border-pink-100"
                                      : "bg-blue-50/70 text-slate-800 rounded-tl-none border border-blue-100"
                                  }`}
                                >
                                  {line.text}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="bg-slate-100/90 rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shadow-xs">
                      <Lock size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-display">
                        🔒 Mode Examen Actif
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        La transcription écrite est désactivée pendant l'écoute. Répondez d'abord aux 5 questions !
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase bg-slate-200 text-slate-600 px-2.5 py-1 rounded-md">
                    Script Verrouillé
                  </span>
                </div>
              )}

              {/* ACTIVE QUESTION PANEL OR FINISHED STATE */}
              {!quizFinished ? (
                <div className="space-y-4">
                  {/* Progress Indicator */}
                  <div className="flex items-center justify-between bg-white border border-slate-200/60 p-4 rounded-xl shadow-xs">
                    <span className="text-xs font-semibold text-slate-500">
                      Questions répondues : <span className="font-bold text-indigo-600">{Object.keys(selectedAnswers).length} / 5</span>
                    </span>
                    <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300" 
                        style={{ width: `${(Object.keys(selectedAnswers).length / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Active Question Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                    <div className="space-y-5">
                      <div>
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-600 block mb-1 font-display">
                          Question {currentQuestionIndex + 1} of 5
                        </span>
                        <h2 className="font-bold text-slate-800 text-base md:text-lg leading-snug">
                          {exercise.questions[currentQuestionIndex].questionText}
                        </h2>
                      </div>

                      {/* Options list: Vertical radio buttons */}
                      <div className="flex flex-col gap-3">
                        {exercise.questions[currentQuestionIndex].options.map((option) => {
                          const questionId = exercise.questions[currentQuestionIndex].id;
                          const isSelected = selectedAnswers[questionId] === option.key;

                          return (
                            <button
                              key={option.key}
                              disabled={quizFinished}
                              onClick={() => handleSelectOption(questionId, option.key)}
                              className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-4 ${
                                quizFinished ? "cursor-not-allowed opacity-85" : "cursor-pointer"
                              } ${
                                isSelected
                                  ? "bg-indigo-50/40 border-indigo-600 ring-1 ring-indigo-600 text-indigo-950 font-medium"
                                  : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700"
                              }`}
                            >
                              <div className="pt-0.5 relative flex items-center justify-center shrink-0">
                                {/* Custom radio button indicator (○ / ●) */}
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"
                                }`}>
                                  {isSelected && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                              </div>
                              <span className="text-xs md:text-sm select-none flex-1 leading-snug">
                                <span className="font-bold mr-1.5">{option.key}.</span>{option.text}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Hint / Indice button for Practice Mode */}
                      {!examMode && !quizFinished && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <details className="group">
                            <summary className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 hover:text-indigo-700 cursor-pointer select-none">
                              <span className="transition-transform group-open:rotate-90">▶</span>
                              <span>💡 Obtenir un indice (Practice Mode)</span>
                            </summary>
                            <div className="mt-2.5 p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl text-xs text-slate-600 leading-relaxed font-medium">
                              <strong>Attention au piège :</strong> {exercise.questions[currentQuestionIndex].commonTrap || exercise.questions[currentQuestionIndex].trap}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => currentQuestionIndex > 0 && setCurrentQuestionIndex((prev) => prev - 1)}
                      disabled={currentQuestionIndex === 0}
                      className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                        currentQuestionIndex === 0
                          ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-40"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 cursor-pointer"
                      }`}
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </button>
                    
                    {currentQuestionIndex < 4 ? (
                      <button
                        onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                        className="flex-1 py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Next
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitExam}
                        className="flex-1 py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        Submit Answers
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* INTERACTIVE ANALYTICAL DIAGNOSTIC DASHBOARD */
                <div className="space-y-6">
                  {/* Phase 8 - AI COACH MESSAGE PANEL */}
                  <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
                    {/* Background glows */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative flex flex-col md:flex-row gap-5 items-start">
                      {/* Left: Mascot Avatar & Action */}
                      <div className="flex md:flex-col items-center gap-4 shrink-0 w-full md:w-36 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
                          <GraduationCap size={28} />
                        </div>
                        <div className="text-left md:text-center">
                          <h4 className="text-xs font-black tracking-wider uppercase text-indigo-300 font-display">
                            Coach Personnel
                          </h4>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/15 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-300 mt-1">
                            <Sparkles size={10} /> Powered by Gemini
                          </span>
                        </div>
                      </div>

                      {/* Right: Coach Feedback Content */}
                      <div className="flex-1 w-full min-h-[140px] border-t md:border-t-0 md:border-l border-slate-800/80 pt-4 md:pt-0 md:pl-6">
                        {loadingCoach ? (
                          <div className="space-y-4 py-3">
                            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold tracking-wide font-display">
                              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                              Analyse en temps réel par le Coach IA...
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
                              Gemini décrypte vos compétences cognitives d'écoute active et prépare des conseils ultra-ciblés basés sur vos erreurs actuelles et passées...
                            </p>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full w-2/3 rounded-full animate-pulse" style={{ animationDuration: "1.5s" }} />
                            </div>
                          </div>
                        ) : coachFeedback ? (
                          <div className="space-y-1 text-slate-200 animate-fade-in text-xs md:text-sm">
                            {renderMarkdown(coachFeedback)}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-xs py-4 flex flex-col items-center justify-center text-center gap-2">
                            <p>Aucune recommandation générée pour cette session.</p>
                            <button 
                              onClick={() => {
                                if (exercise) {
                                  fetchCoachFeedback(sessionScore, exercise, selectedAnswers, skillStats);
                                }
                              }}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg border border-indigo-500/20 transition cursor-pointer"
                            >
                              Générer le rapport
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Panel: Score and Question Navigator */}
                    <div className="lg:col-span-4 space-y-4">
                      {/* Score Summary Card */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col items-center text-center">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          Rapport de Performance
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-6xl font-black text-indigo-600 tracking-tight font-display">
                            {Math.round((sessionScore / 5) * 100)}%
                          </span>
                        </div>
                        <div className="mt-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-sm rounded-full tracking-wider uppercase font-display">
                          Niveau {activeDifficulty}
                        </div>
                        <div className="mt-4 text-xs text-slate-500 font-medium">
                          Score : <span className="font-bold text-slate-800">{sessionScore} / 5</span> correct
                        </div>
                      </div>

                      {/* Question Selector Tabs */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-2 pb-2 border-b border-slate-100 font-display">
                          Questions
                        </span>
                        <div className="flex flex-col gap-1.5 pt-1">
                          {exercise.questions.map((q, idx) => {
                            const isCorrect = selectedAnswers[q.id] === q.correctAnswer;
                            const isSelected = selectedFeedbackIndex === idx;

                            return (
                              <button
                                key={q.id}
                                onClick={() => setSelectedFeedbackIndex(idx)}
                                className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100"
                                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span>Question {idx + 1}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {isCorrect ? (
                                    <span className={`text-base leading-none ${isSelected ? "text-white" : "text-emerald-600"}`}>✔</span>
                                  ) : (
                                    <span className={`text-sm leading-none ${isSelected ? "text-white" : "text-red-500"}`}>✘</span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action button */}
                      <button
                        onClick={handleGenerateExercise}
                        className="w-full py-4 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles size={14} />
                        Nouveau Test TEF
                      </button>
                    </div>

                    {/* Right Panel: Detailed Diagnostics */}
                    <div className="lg:col-span-8">
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 animate-fade-in">
                        <div>
                          <span className="text-xs font-black uppercase tracking-widest text-indigo-600 block mb-1 font-display">
                            Analyse détaillée • Question {selectedFeedbackIndex + 1}
                          </span>
                          <h3 className="font-bold text-slate-900 text-base md:text-lg leading-snug">
                            {exercise.questions[selectedFeedbackIndex].questionText}
                          </h3>
                        </div>

                        {/* Option Choices */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {exercise.questions[selectedFeedbackIndex].options.map((opt) => {
                            const isOptCorrect = opt.key === exercise.questions[selectedFeedbackIndex].correctAnswer;
                            const isOptChosen = opt.key === selectedAnswers[exercise.questions[selectedFeedbackIndex].id];
                            
                            let style = "border-slate-150 bg-slate-50/30 text-slate-600";
                            if (isOptCorrect) {
                              style = "border-emerald-500 bg-emerald-50/40 text-emerald-950 font-bold";
                            } else if (isOptChosen) {
                              style = "border-red-400 bg-red-50/40 text-red-950 font-medium";
                            }

                            return (
                              <div key={opt.key} className={`p-4 border rounded-xl text-xs flex gap-3.5 items-start ${style}`}>
                                <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                                  isOptCorrect
                                    ? "bg-emerald-500 text-white"
                                    : isOptChosen
                                    ? "bg-red-500 text-white"
                                    : "bg-slate-200 text-slate-500"
                                }`}>
                                  {opt.key}
                                </span>
                                <span className="leading-snug pt-0.5">{opt.text}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Diagnostics Breakdown */}
                        <div className="border-t border-slate-100 pt-5 space-y-4">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block font-display">
                            Why was this answer correct?
                          </span>

                          {!examMode ? (
                            <div className="space-y-4">
                              {/* 1. Keyword */}
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80 space-y-1">
                                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                                  Keyword
                                </span>
                                <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg inline-block">
                                  {exercise.questions[selectedFeedbackIndex].keyword && exercise.questions[selectedFeedbackIndex].keyword !== "None" 
                                    ? exercise.questions[selectedFeedbackIndex].keyword 
                                    : "Aucun mot-clé direct"}
                                </span>
                              </div>

                              {/* 2. Reasoning */}
                              <div className="p-5 bg-emerald-50/20 border border-emerald-100/80 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                                    Reasoning
                                  </span>
                                  <span className="text-[9px] bg-emerald-100/70 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md">
                                    Listening Strategy
                                  </span>
                                </div>
                                <p className="text-xs md:text-sm leading-relaxed text-slate-700">
                                  {exercise.questions[selectedFeedbackIndex].why || exercise.questions[selectedFeedbackIndex].explanation}
                                </p>
                              </div>

                              {/* 3. Common TEF Trap */}
                              <div className="p-5 bg-amber-50/20 border border-amber-100/80 rounded-xl space-y-1.5">
                                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                                  Common TEF Trap
                                </span>
                                <p className="text-xs md:text-sm leading-relaxed text-slate-700 font-medium">
                                  {exercise.questions[selectedFeedbackIndex].trap || exercise.questions[selectedFeedbackIndex].commonTrap}
                                </p>
                              </div>

                              {/* 4. Skill Tested */}
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                                  Skill Tested
                                </span>
                                <span className="text-sm font-bold text-slate-800">
                                  {formatSkillDisplay(exercise.questions[selectedFeedbackIndex].skillTested || (selectedFeedbackIndex === 0 ? "Global understanding" : selectedFeedbackIndex === 1 ? "Detail comprehension" : selectedFeedbackIndex === 2 ? "Speaker's attitude/opinion" : selectedFeedbackIndex === 3 ? "Inference/implicit comprehension" : "Idiom & vocabulary in context"))}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center gap-2.5 text-slate-500 text-xs font-semibold">
                              <Lock size={14} className="text-slate-400" />
                              <span>Les explications de correction sont désactivées en Mode Examen officiel.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* FOOTER - Professional Polish Style */}
      <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-6 md:px-8 text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-widest">
        <div className="flex gap-4">
          <span>Local Storage Actif</span>
          <span className="text-slate-300">|</span>
          <span>Prêt pour l'examen</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Système d'évaluation connecté</span>
        </div>
      </footer>
    </div>
  );
}
