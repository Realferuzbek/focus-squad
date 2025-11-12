import type { ReactNode } from "react";

export type Locale = "en" | "ru" | "uz";

export type FeatureKey =
  | "leaderboard"
  | "chat"
  | "motivation"
  | "live"
  | "tasks"
  | "timer"
  | "research-positions"
  | "internship-positions"
  | "essay-workshop"
  | "universities-emails"
  | "hobbies-opportunities"
  | "olympiad-opportunities";

export interface NavbarTranslations {
  reviewerPanel: string;
  switchAccount: string;
  deleteAccount: string;
  deleteAccountConfirm: string;
  languageMenuLabel: string;
  languages: Record<Locale, string>;
}

export interface DashboardTranslations {
  welcomeTag: string;
  welcomeFallback: string;
  viewProfile: string;
  settings: string;
  features: Record<
    FeatureKey,
    {
      title: string;
      description: string;
    }
  >;
}

export interface MotivationTranslations {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  refreshedLabel: string;
  rotationNote: string;
  todaysMantra: string;
  upNext: string;
  rotatesAtMidnight: string;
  dayLabel: string;
  cycleLabel: string;
  totalQuotesLabel: string;
  useVaultTitle: string;
  useVaultTips: [ReactNode, ReactNode, ReactNode];
}

export interface CommonTranslations {
  comingSoon: string;
  liveNow: string;
  backToDashboard: string;
}

export interface Translations {
  nav: NavbarTranslations;
  common: CommonTranslations;
  dashboard: DashboardTranslations;
  motivation: MotivationTranslations;
}

export const LOCALE_DEFAULT: Locale = "en";

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇺🇸",
  ru: "🇷🇺",
  uz: "🇺🇿",
};

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    nav: {
      reviewerPanel: "Reviewer panel",
      switchAccount: "Switch account",
      deleteAccount: "Delete account",
      deleteAccountConfirm:
        "Deleting your account removes your profile, saved progress, and Telegram link. This cannot be undone. Continue?",
      languageMenuLabel: "Change language",
      languages: {
        en: "English",
        ru: "Русский",
        uz: "Oʻzbekcha",
      },
    },
    common: {
      comingSoon: "Coming soon",
      liveNow: "Live now",
      backToDashboard: "Back to dashboard",
    },
    dashboard: {
      welcomeTag: "Welcome",
      welcomeFallback: "Focus warrior",
      viewProfile: "View profile",
      settings: "Settings",
      features: {
        leaderboard: {
          title: "Leaderboard",
          description: "Track the top performers and celebrate focus legends.",
        },
        chat: {
          title: "Community Chat",
          description:
            "Drop updates, share wins, and stay accountable together.",
        },
        motivation: {
          title: "Motivation Vault",
          description: "Daily quotes, mindset hacks, and success stories.",
        },
        live: {
          title: "Live Stream Studio",
          description: "Join focus rooms and study together in real time.",
        },
        tasks: {
          title: "Task Scheduler",
          description: "Plan lessons, set clusters, and lock in your agenda.",
        },
        timer: {
          title: "Timer",
          description: "Stay locked-in with precision intervals and breaks.",
        },
        "research-positions": {
          title: "Research Positions",
          description:
            "Find labs and mentors looking for ambitious collaborators.",
        },
        "internship-positions": {
          title: "Internship Positions",
          description:
            "Track curated roles to sharpen skills and build your resume.",
        },
        "essay-workshop": {
          title: "Essay Workshop",
          description:
            "Blueprint winning personal statements with peer-approved frameworks.",
        },
        "universities-emails": {
          title: "Universities Emails",
          description:
            "Access contact lists to reach admissions and program coordinators.",
        },
        "hobbies-opportunities": {
          title: "Hobbies Opportunities",
          description:
            "Discover clubs, challenges, and creative outlets to stay balanced.",
        },
        "olympiad-opportunities": {
          title: "Olympiad Opportunities",
          description:
            "Keep tabs on upcoming contests and prep resources for champions.",
        },
      },
    },
    motivation: {
      heroTag: "Word of the day",
      heroTitle: "Motivation Vault",
      heroSubtitle:
        "Daily focus fuel synchronized with our Telegram leaderboard. Check in, repeat the mantra, and let the squad energy stack.",
      refreshedLabel: "Refreshed",
      rotationNote: "Rotation locks at 00:00 Asia/Tashkent each day.",
      todaysMantra: "Today's mantra",
      upNext: "Up next",
      rotatesAtMidnight: "Rotates at midnight (UZT)",
      dayLabel: "Day",
      cycleLabel: "Cycle",
      totalQuotesLabel: "Total quotes",
      useVaultTitle: "How to use the Vault",
      useVaultTips: [
        "Read it out loud when you open your daily plan.",
        "Drop it into the community chat as your accountability ping.",
        "Pair it with a timer block: mantra → plan → focus.",
      ],
    },
  },
  ru: {
    nav: {
      reviewerPanel: "Панель ревьюеров",
      switchAccount: "Сменить аккаунт",
      deleteAccount: "Удалить аккаунт",
      deleteAccountConfirm:
        "Удаление аккаунта уберёт профиль, историю и связь с Telegram. Это действие необратимо. Продолжить?",
      languageMenuLabel: "Выбрать язык",
      languages: {
        en: "Английский",
        ru: "Русский",
        uz: "O‘zbekcha",
      },
    },
    common: {
      comingSoon: "Скоро",
      liveNow: "В эфире",
      backToDashboard: "Назад на дашборд",
    },
    dashboard: {
      welcomeTag: "Добро пожаловать",
      welcomeFallback: "Боец фокуса",
      viewProfile: "Профиль",
      settings: "Настройки",
      features: {
        leaderboard: {
          title: "Таблица лидеров",
          description: "Следите за лучшими и празднуйте легенд фокуса.",
        },
        chat: {
          title: "Чат сообщества",
          description:
            "Делитесь успехами, поддерживайте друг друга и держите темп.",
        },
        motivation: {
          title: "Мотивационный сейф",
          description: "Ежедневные цитаты, майндсет и истории побед.",
        },
        live: {
          title: "Студия прямых эфиров",
          description:
            "Присоединяйтесь к фокус-румам и учитесь вместе в реальном времени.",
        },
        tasks: {
          title: "Планировщик задач",
          description:
            "Планируйте занятия, настраивайте блоки и фиксируйте приоритеты.",
        },
        timer: {
          title: "Таймер",
          description: "Держите ритм с точными интервалами и перерывами.",
        },
        "research-positions": {
          title: "Исследовательские позиции",
          description:
            "Находите лаборатории и наставников, готовых принять амбициозных ребят.",
        },
        "internship-positions": {
          title: "Стажировки",
          description:
            "Подборка ролей, чтобы прокачать навыки и усилить резюме.",
        },
        "essay-workshop": {
          title: "Эссе-воркшоп",
          description:
            "Создавайте сильные личные истории с проверенными шаблонами.",
        },
        "universities-emails": {
          title: "Письма университетам",
          description:
            "Контакты приёмных комиссий и координаторов программ в одном месте.",
        },
        "hobbies-opportunities": {
          title: "Возможности для хобби",
          description: "Клубы, челленджи и творческие активности для баланса.",
        },
        "olympiad-opportunities": {
          title: "Олимпиады и конкурсы",
          description:
            "Следите за стартами и ресурсами подготовки к олимпиадам.",
        },
      },
    },
    motivation: {
      heroTag: "Слово дня",
      heroTitle: "Мотивационный сейф",
      heroSubtitle:
        "Ежедневный заряд фокуса синхронизирован с нашим телеграм-лайвчатом. Прочитай мантру, настройся и вперед к прогрессу.",
      refreshedLabel: "Обновлено",
      rotationNote: "Новая мантра появляется каждый день в 00:00 по Ташкенту.",
      todaysMantra: "Мантра дня",
      upNext: "Далее",
      rotatesAtMidnight: "Обновится в полночь (UZT)",
      dayLabel: "День",
      cycleLabel: "Цикл",
      totalQuotesLabel: "Всего цитат",
      useVaultTitle: "Как использовать сейф",
      useVaultTips: [
        "Прочитай вслух, когда открываешь план на день.",
        "Поделись в чате как сигнал ответственности.",
        "Свяжи с таймером: мантра → план → фокус.",
      ],
    },
  },
  uz: {
    nav: {
      reviewerPanel: "Sharhlovchilar paneli",
      switchAccount: "Hisobni almashtirish",
      deleteAccount: "Hisobni o'chirish",
      deleteAccountConfirm:
        "Hisobingiz, saqlangan ma'lumotlar va Telegram bog'lanishi to'liq o'chiriladi. Bu amalni qaytarib bo'lmaydi. Davom etasizmi?",
      languageMenuLabel: "Tilni tanlash",
      languages: {
        en: "Inglizcha",
        ru: "Ruscha",
        uz: "O‘zbekcha",
      },
    },
    common: {
      comingSoon: "Tez orada",
      liveNow: "Jonli",
      backToDashboard: "Bosh sahifaga qaytish",
    },
    dashboard: {
      welcomeTag: "Xush kelibsiz",
      welcomeFallback: "Fokus jangchisi",
      viewProfile: "Profil",
      settings: "Sozlamalar",
      features: {
        leaderboard: {
          title: "Reyting",
          description:
            "Eng faol qatnashchilarni kuzatib boring va fokus afsonalarini tabriklang.",
        },
        chat: {
          title: "Hamjamiyat chat",
          description:
            "Yangiliklar bilan o‘rtoqlashing, g‘alabalarni baham ko‘ring va birga intiling.",
        },
        motivation: {
          title: "Motivatsiya xazinasi",
          description:
            "Har kuni yangi iqtiboslar, fikrlar va muvaffaqiyat hikoyalari.",
        },
        live: {
          title: "Jonli efir studiyasi",
          description:
            "Fokus xonalariga qo‘shiling va real vaqt rejimida birga o‘qing.",
        },
        tasks: {
          title: "Vazifa rejalashtirgich",
          description:
            "Darslarni rejalang, bloklar yarating va kun tartibini mustahkamlang.",
        },
        timer: {
          title: "Taymer",
          description: "Aniq interval va tanaffuslar bilan ritmni saqlang.",
        },
        "research-positions": {
          title: "Ilmiy loyihalar",
          description:
            "Ambitsiyali hamkorlarni qidirayotgan laboratoriya va ustozlarni toping.",
        },
        "internship-positions": {
          title: "Amaliyot imkoniyatlari",
          description:
            "Ko‘nikmalarni charxlash va rezümengizni boyitish uchun tanlangan vakansiyalar.",
        },
        "essay-workshop": {
          title: "Esse ustaxonasi",
          description:
            "G‘olib arizalar uchun hikoyalarni kuchli asoslar bilan tuzing.",
        },
        "universities-emails": {
          title: "Universitetlar kontaktlari",
          description:
            "Qabul komissiyalari va dastur koordinatorlariga yozish uchun ma’lumotlar.",
        },
        "hobbies-opportunities": {
          title: "Hobbi imkoniyatlari",
          description:
            "Klublar, challenjlar va ijodiy loyihalar bilan muvozanatni saqlang.",
        },
        "olympiad-opportunities": {
          title: "Olimpiadalar",
          description:
            "Musobaqalar va tayyorgarlik resurslarini kuzatib boring.",
        },
      },
    },
    motivation: {
      heroTag: "Kun so‘zi",
      heroTitle: "Motivatsiya xazinasi",
      heroSubtitle:
        "Har kungi fokus energiyasi Telegramdagi reyting bilan sinxron. Mantirani o‘qing, kayfiyatni sozlang va jamoa bilan oldinga yuring.",
      refreshedLabel: "Yangilandi",
      rotationNote:
        "Har kuni soat 00:00 (Toshkent) da yangi mantra paydo bo‘ladi.",
      todaysMantra: "Bugungi mantra",
      upNext: "Keyingi",
      rotatesAtMidnight: "Tungi soat 00:00 da yangilanadi (UZT)",
      dayLabel: "Kun",
      cycleLabel: "Tsikl",
      totalQuotesLabel: "Jami iqtiboslar",
      useVaultTitle: "Xazinadan foydalanish",
      useVaultTips: [
        "Kun rejasi oldidan ovoz chiqarib o‘qing.",
        "Javobgarlik signali sifatida chatga yuboring.",
        "Taymer bilan bog‘lang: mantra → reja → fokus.",
      ],
    },
  },
};

export function isLocale(value: string | undefined | null): value is Locale {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(TRANSLATIONS, value);
}
