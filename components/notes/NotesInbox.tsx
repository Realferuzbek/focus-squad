"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MoreHorizontal,
  Pin,
  PinOff,
  Search,
  Send,
  Trash2,
} from "lucide-react";

export type NoteEntry = {
  id: string;
  text: string;
  pinned: boolean;
  convertedTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  pending?: boolean;
  failed?: boolean;
};

type NotesInboxProps = {
  notes: NoteEntry[];
  loading: boolean;
  onSend: (text: string) => void;
  onRetry: (note: NoteEntry) => void;
  onTogglePin: (note: NoteEntry) => void;
  onDelete: (note: NoteEntry) => void;
  onConvert: (note: NoteEntry) => void;
};

const MAX_COMPOSER_LINES = 6;
const GROUP_WINDOW_MINUTES = 3;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDayLabel(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  return target.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function textMatches(text: string, query: string) {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let lastIndex = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), match: false });
    }
    parts.push({
      text: text.slice(index, index + needle.length),
      match: true,
    });
    lastIndex = index + needle.length;
    index = lower.indexOf(needle, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false });
  }
  return parts.map((part, idx) =>
    part.match ? (
      <mark
        key={`${part.text}-${idx}`}
        className="rounded bg-amber-300/20 px-0.5 text-amber-100"
      >
        {part.text}
      </mark>
    ) : (
      <span key={`${part.text}-${idx}`}>{part.text}</span>
    ),
  );
}

function useComposerAutoSize(text: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = Number.parseFloat(
      window.getComputedStyle(el).lineHeight || "20",
    );
    const maxHeight = lineHeight * MAX_COMPOSER_LINES;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

  return ref;
}

export default function NotesInbox({
  notes,
  loading,
  onSend,
  onRetry,
  onTogglePin,
  onDelete,
  onConvert,
}: NotesInboxProps) {
  const [composer, setComposer] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const composerRef = useComposerAutoSize(composer);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const firstMatchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (notes.length === 0 && !loading) {
      composerRef.current?.focus();
    }
  }, [notes.length, loading, composerRef]);

  const { pinnedNotes, regularNotes } = useMemo(() => {
    const pinnedList = notes.filter((note) => note.pinned);
    const regularList = notes.filter((note) => !note.pinned);
    return { pinnedNotes: pinnedList, regularNotes: regularList };
  }, [notes]);

  const filteredPinned = useMemo(
    () => pinnedNotes.filter((note) => textMatches(note.text, searchQuery)),
    [pinnedNotes, searchQuery],
  );
  const filteredRegular = useMemo(
    () => regularNotes.filter((note) => textMatches(note.text, searchQuery)),
    [regularNotes, searchQuery],
  );

  const firstMatchId = useMemo(() => {
    const combined = [...filteredPinned, ...filteredRegular];
    return combined[0]?.id ?? null;
  }, [filteredPinned, filteredRegular]);

  useEffect(() => {
    if (!firstMatchId) return;
    if (!firstMatchRef.current) return;
    firstMatchRef.current.scrollIntoView({ block: "center" });
  }, [firstMatchId, searchQuery]);

  const handleSend = useCallback(() => {
    const trimmed = composer.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setComposer("");
  }, [composer, onSend]);

  const handleComposerKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  function renderNoteList(list: NoteEntry[]) {
    const items: React.ReactNode[] = [];
    list.forEach((note, index) => {
      const createdAt = new Date(note.createdAt);
      const prev = list[index - 1];
      const prevTime = prev ? new Date(prev.createdAt) : null;
      const isGrouped =
        prevTime &&
        createdAt.getTime() - prevTime.getTime() <= GROUP_WINDOW_MINUTES * 60000;
      const dayLabel =
        !prevTime ||
        createdAt.toDateString() !== prevTime.toDateString()
          ? formatDayLabel(createdAt)
          : null;

      if (dayLabel) {
        items.push(
          <div key={`${note.id}-day`} className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/35">
              {dayLabel}
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>,
        );
      }

      const isFirstMatch = note.id === firstMatchId;
      items.push(
        <div
          key={note.id}
          ref={isFirstMatch ? firstMatchRef : undefined}
          className={classNames(
            "group relative rounded-2xl border border-white/10 bg-[#0c0c16] px-4 py-3 text-sm text-white/90 shadow-[0_10px_30px_rgba(2,2,10,0.35)] transition",
            isGrouped ? "mt-1" : "mt-3",
            note.failed && "border-rose-400/30",
          )}
        >
          <div className="whitespace-pre-wrap leading-relaxed">
            {highlightText(note.text, searchQuery)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
            <div className="flex items-center gap-2">
              {note.convertedTaskId && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Converted
                </span>
              )}
              {note.pending && <span>Sending...</span>}
              {note.failed && (
                <button
                  type="button"
                  onClick={() => onRetry(note)}
                  className="text-rose-200 hover:text-rose-100"
                >
                  Retry
                </button>
              )}
            </div>
            <span>{formatTime(createdAt)}</span>
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onConvert(note)}
              className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/20"
            >
              Convert → Task
            </button>
            <button
              type="button"
              onClick={() => onTogglePin(note)}
              className="rounded-md p-1.5 text-white/60 hover:text-white"
              aria-label={note.pinned ? "Unpin" : "Pin"}
            >
              {note.pinned ? (
                <PinOff className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Pin className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => onDelete(note)}
              className="rounded-md p-1.5 text-white/60 hover:text-white"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>,
      );
    });
    return items;
  }

  return (
    <section className="flex h-full w-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">
            Notes
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Notes Inbox</h1>
        </div>
          <div className="flex items-center gap-2">
            {searchOpen && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                <Search className="h-4 w-4" aria-hidden />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search notes..."
                  className="w-44 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/40 md:w-56"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Search"
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen && (
            <div className="relative">
              <div className="absolute right-0 top-10 w-40 rounded-xl border border-white/10 bg-[#0b0b16] p-2 text-xs text-white/70">
                <p className="px-2 py-1">Export</p>
                <p className="px-2 py-1">Clear</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
          {loading ? (
            <p className="text-sm text-white/50">Loading notes...</p>
          ) : notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-6 text-sm text-white/60">
              <p className="text-base font-medium text-white/80">
                Your inbox is empty.
              </p>
              <p className="mt-1 text-sm text-white/50">
                Type anything below — ideas, tasks, links.
              </p>
            </div>
          ) : (
            <>
              {filteredPinned.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/35">
                    Pinned
                  </p>
                  <div>{renderNoteList(filteredPinned)}</div>
                </div>
              )}
              <div>{renderNoteList(filteredRegular)}</div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#0c0c16] p-3">
          <div className="flex items-end gap-3">
            <textarea
              ref={composerRef}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={handleComposerKey}
              placeholder="Write a note..."
              rows={1}
              className="min-h-[24px] flex-1 resize-none bg-transparent text-sm text-white/90 outline-none placeholder:text-white/40"
            />
            <button
              type="button"
              onClick={handleSend}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20"
              aria-label="Send"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
