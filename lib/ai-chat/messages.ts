import type { SupportedLanguage } from "./language";

const OFF_TOPIC_RESPONSES: Record<SupportedLanguage, string[]> = {
  en: [
    "Hey superstar! I’m here to help with anything related to this website. Ask about features, pages, or how things work here ✨",
    "Love the curiosity, but I’m laser-focused on this site. Hit me with a question about our tools or pages!",
  ],
  uz: [
    "Salom! Men aynan shu sayt bo‘yicha yordam beraman. Sahifalar, funksiyalar va bu yerdagi ish tartibi haqida so‘rashingiz mumkin ✨",
    "Zo‘r savol, lekin men bu sayt mavzulariga ixtisoslashganman. Shu yerdagi imkoniyatlar haqida so‘rashing!",
  ],
  ru: [
    "Привет! Я подсказываю только по этому сайту. Спроси про его разделы, функции или как тут всё устроено ✨",
    "Классный вопрос, но я отвечаю только про этот сайт. Напиши, что хочешь узнать о разделах или возможностях здесь!",
  ],
};

const MODERATION_RESPONSES: Record<SupportedLanguage, string[]> = {
  en: [
    "I want to keep things positive and on-topic, so let’s stick to questions about this site.",
  ],
  uz: [
    "Hammasi xavfsiz qolishi uchun, iltimos, shu saytga oid mavzular bilan davom etamiz.",
  ],
  ru: [
    "Поддерживаю только спокойные и безопасные темы. Давай обсудим что-нибудь по сайту.",
  ],
};

const ERROR_RESPONSES: Record<SupportedLanguage, string[]> = {
  en: [
    "Uh oh, something glitchy happened. Ask me again in a moment and I’ll be ready!",
  ],
  uz: [
    "Afsuski, kichik nosozlik yuz berdi. Birozdan so‘ng yana so‘rab ko‘ring!",
  ],
  ru: [
    "Поймал глюк. Спроси ещё раз через минутку — я снова буду в строю!",
  ],
};

export function getOffTopicResponse(language: SupportedLanguage) {
  return pick(OFF_TOPIC_RESPONSES, language);
}

export function getModerationResponse(language: SupportedLanguage) {
  return pick(MODERATION_RESPONSES, language);
}

export function getErrorResponse(language: SupportedLanguage) {
  return pick(ERROR_RESPONSES, language);
}

function pick(
  source: Record<SupportedLanguage, string[]>,
  language: SupportedLanguage,
) {
  const options = source[language]?.length
    ? source[language]
    : source.en ?? [];
  if (!options.length) return "";
  const index = Math.floor(Math.random() * options.length);
  return options[index];
}
