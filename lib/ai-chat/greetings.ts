import type { SupportedLanguage } from "./language";

const GREETING_MATCHERS: Array<{ regex: RegExp; language: SupportedLanguage }> =
  [
    { regex: /\b(hi|hello|hey|yo|what's up)\b/i, language: "en" },
    { regex: /\b(salom|assalomu(?:\s+alaykum)?)\b/i, language: "uz" },
    { regex: /\b(привет|здравствуй|добрый\s+день)\b/i, language: "ru" },
  ];

const GREETING_RESPONSES: Record<SupportedLanguage, string[]> = {
  en: [
    "Hey! Glad you're here—what part of the site are we leveling up today?",
    "Welcome back, superstar! Point me at any feature you want to explore ✨",
    "Hi friend! Ask me anything about this site and I'll cheer you on.",
    "Yo! Let's make some progress—what site detail should we dive into?",
  ],
  uz: [
    "Salom! Saytning qaysi bo‘limini birga kuchaytiramiz? 💪",
    "Xush kelibsiz! Shu yerdagi funksiyalar bo‘yicha savollaringizni kutaman ✨",
    "Hey! Sayt haqida nimani aniqligini istaysiz? Men doim yordamga tayyorman.",
    "Assalomu alaykum! Sahifalar va imkoniyatlar bo‘yicha savollar bormi?",
  ],
  ru: [
    "Привет! Что из возможностей сайта прокачаем прямо сейчас? ✨",
    "Рада тебя видеть! Спрашивай про любые разделы сайта — я на связи.",
    "Хей! Подскажешь, какую часть сайта разобрать? Погнали! 💪",
    "Добро пожаловать! Спроси про функции или страницы — поддержу тебя.",
  ],
};

const previousGreetingIndex: Record<SupportedLanguage, number> = {
  en: -1,
  uz: -1,
  ru: -1,
};

export function detectGreeting(input: string): SupportedLanguage | null {
  if (!input || !input.trim()) return null;
  for (const matcher of GREETING_MATCHERS) {
    if (matcher.regex.test(input)) {
      return matcher.language;
    }
  }
  return null;
}

export function getGreetingReply(language: SupportedLanguage): string {
  const responses = GREETING_RESPONSES[language] ?? GREETING_RESPONSES.en;
  if (!responses.length) {
    return "Hey! I'm ready to help with anything about this site.";
  }
  let index = Math.floor(Math.random() * responses.length);
  if (index === previousGreetingIndex[language]) {
    index = (index + 1) % responses.length;
  }
  previousGreetingIndex[language] = index;
  return responses[index];
}
