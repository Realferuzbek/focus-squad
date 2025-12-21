"use client";

import { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
} from "lucide-react";
import type {
  TaskCalendar,
  TaskPrivateItem,
  TaskPrivateItemKind,
} from "@/lib/taskSchedulerTypes";

type Section = "home" | "notes" | "private" | "settings";
type SurfaceView = "planner" | "calendar";

type NavItem = {
  id: Section;
  label: string;
  description: string;
  icon: string;
};

type CalendarCreateInput = {
  name: string;
  color: string;
};

type CalendarPatchInput = Partial<
  Pick<TaskCalendar, "name" | "color" | "isDefault" | "isVisible" | "sortOrder">
>;

const CALENDAR_COLORS = [
  "#8b5cf6",
  "#9b7bff",
  "#f472b6",
  "#22d3ee",
  "#34d399",
  "#facc15",
];

type PlannerSidebarProps = {
  navItems: NavItem[];
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  activeSurface: SurfaceView;
  onSurfaceChange: (surface: SurfaceView) => void;
  privateItems: TaskPrivateItem[];
  privateLoading: boolean;
  privateError: string | null;
  activePrivateItemId: string | null;
  onSelectPrivateItem: (id: string) => void;
  onAddPrivateItem: () => void;
  kindMeta: Record<TaskPrivateItemKind, { label: string; icon: string }>;
  calendars: TaskCalendar[];
  calendarsLoading: boolean;
  onCreateCalendar: (input: CalendarCreateInput) => Promise<void>;
  onUpdateCalendar: (
    calendarId: string,
    patch: CalendarPatchInput,
  ) => Promise<void>;
  onDeleteCalendar: (calendarId: string) => Promise<void>;
  workspaceTitle?: string;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function PlannerSidebar({
  navItems,
  activeSection,
  onSectionChange,
  activeSurface,
  onSurfaceChange,
  privateItems,
  privateLoading,
  privateError,
  activePrivateItemId,
  onSelectPrivateItem,
  onAddPrivateItem,
  kindMeta,
  onCreateCalendar,
  onUpdateCalendar,
  workspaceTitle,
}: PlannerSidebarProps) {
  const homeItem = navItems.find((item) => item.id === "home");
  const notesItem = navItems.find((item) => item.id === "notes");
  const privateItem = navItems.find((item) => item.id === "private");
  const settingsItem = navItems.find((item) => item.id === "settings");
  const workspaceName = workspaceTitle?.trim() || "Workspace";
  const workspaceInitial = workspaceName[0]?.toUpperCase() || "W";

  const isHomeActive = activeSection === "home";
  const isNotesActive = activeSection === "notes";
  const isSettingsActive = activeSection === "settings";
  const isCalendarActive = activeSurface === "calendar";
  const [createCalendarOpen, setCreateCalendarOpen] = useState(false);
  const [createCalendarName, setCreateCalendarName] = useState("");
  const [createCalendarColor, setCreateCalendarColor] = useState(
    CALENDAR_COLORS[0],
  );
  const [createCalendarError, setCreateCalendarError] = useState<string | null>(
    null,
  );
  const [createCalendarSaving, setCreateCalendarSaving] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TaskCalendar | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);

  useEffect(() => {
    if (!renameTarget) return;
    setRenameDraft(renameTarget.name);
    setRenameError(null);
  }, [renameTarget]);

  const handlePrivateSelect = (id: string) => {
    onSelectPrivateItem(id);
  };

  const handleAddPrivateItem = () => {
    onAddPrivateItem();
  };

  async function handleCreateCalendarSubmit() {
    const trimmed = createCalendarName.trim();
    if (!trimmed) {
      setCreateCalendarError("Name is required.");
      return;
    }
    setCreateCalendarError(null);
    setCreateCalendarSaving(true);
    try {
      await onCreateCalendar({ name: trimmed, color: createCalendarColor });
      setCreateCalendarOpen(false);
      setCreateCalendarName("");
    } catch (error) {
      setCreateCalendarError(
        error instanceof Error ? error.message : "Failed to create calendar.",
      );
    } finally {
      setCreateCalendarSaving(false);
    }
  }

  async function handleRenameCalendarSubmit() {
    if (!renameTarget) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      setRenameError("Name is required.");
      return;
    }
    if (trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenameSaving(true);
    try {
      await onUpdateCalendar(renameTarget.id, { name: trimmed });
      setRenameTarget(null);
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : "Failed to rename calendar.",
      );
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <>
      <div className="flex h-full flex-col bg-[#0c0c16] px-2.5 py-3 text-sm text-white">
        <div className="flex h-9 items-center justify-between rounded-md px-2 transition hover:bg-white/5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold uppercase text-white/70">
              {workspaceInitial}
            </div>
            <p className="truncate text-sm font-medium text-white">
              {workspaceName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Workspace menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="planner-sidebar-scroll mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div>
            <p className="px-2 text-[11px] uppercase tracking-[0.2em] text-white/35">
              Navigation
            </p>
            <div className="mt-1 space-y-1">
              <button
                type="button"
                onClick={() => onSectionChange("home")}
                title={homeItem?.description}
                className={classNames(
                  "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition",
                  isHomeActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center text-[15px]">
                  {homeItem?.icon ?? "H"}
                </span>
                <span className="truncate">{homeItem?.label ?? "Home"}</span>
              </button>
              <button
                type="button"
                onClick={() => onSectionChange("notes")}
                title={notesItem?.description}
                className={classNames(
                  "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition",
                  isNotesActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center text-[15px]">
                  {notesItem?.icon ?? "N"}
                </span>
                <span className="truncate">{notesItem?.label ?? "Notes"}</span>
              </button>
              <button
                type="button"
                onClick={() => onSurfaceChange("calendar")}
                className={classNames(
                  "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition",
                  isCalendarActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  <CalendarIcon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="truncate">Calendar</span>
              </button>
            </div>
          </div>

          <div>
            <p className="px-2 text-[11px] uppercase tracking-[0.2em] text-white/35">
              {privateItem?.label ?? "Private"}
            </p>
            <div className="mt-1 space-y-1">
              {privateLoading ? (
                <div className="rounded-md bg-white/5 px-2 py-2 text-xs text-white/45">
                  Loading private items...
                </div>
              ) : privateError ? (
                <div className="rounded-md bg-rose-500/10 px-2 py-2 text-xs text-rose-200">
                  {privateError}
                </div>
              ) : privateItems.length === 0 ? (
                <div className="rounded-md bg-white/5 px-2 py-2 text-xs text-white/45">
                  No private items yet.
                </div>
              ) : (
                privateItems.map((item) => {
                  const isActive = activePrivateItemId === item.id;
                  const meta = kindMeta[item.kind];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePrivateSelect(item.id)}
                      className={classNames(
                        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition",
                        isActive
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className="flex h-5 w-5 items-center justify-center text-[14px]">
                        {meta.icon}
                      </span>
                      <span className="truncate">{item.title}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-[0.2em] text-white/35">
                        {meta.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={handleAddPrivateItem}
              className="mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              + Add new
            </button>
          </div>

        </div>

        <div className="mt-auto border-t border-white/5 pt-2">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onSectionChange("settings")}
              title={settingsItem?.description}
              className={classNames(
                "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition",
                isSettingsActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center text-[13px]">
                {settingsItem?.icon ?? "S"}
              </span>
              <span className="truncate">
                {settingsItem?.label ?? "Settings"}
              </span>
            </button>
            <button
              type="button"
              aria-disabled="true"
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-white/40"
            >
              <span className="flex h-5 w-5 items-center justify-center text-[11px] font-semibold text-white/40">
                T
              </span>
              <span className="truncate">Trash</span>
            </button>
          </div>
        </div>
      </div>
      {createCalendarOpen && (
        <CalendarDialog
          title="New calendar"
          submitLabel="Create"
          name={createCalendarName}
          onNameChange={(value) => {
            setCreateCalendarName(value);
            if (createCalendarError) setCreateCalendarError(null);
          }}
          color={createCalendarColor}
          colors={CALENDAR_COLORS}
          onColorChange={setCreateCalendarColor}
          error={createCalendarError}
          saving={createCalendarSaving}
          onClose={() => setCreateCalendarOpen(false)}
          onSubmit={handleCreateCalendarSubmit}
        />
      )}
      {renameTarget && (
        <CalendarDialog
          title="Rename calendar"
          submitLabel="Save"
          name={renameDraft}
          onNameChange={(value) => {
            setRenameDraft(value);
            if (renameError) setRenameError(null);
          }}
          error={renameError}
          saving={renameSaving}
          onClose={() => setRenameTarget(null)}
          onSubmit={handleRenameCalendarSubmit}
        />
      )}
    </>
  );
}

type CalendarDialogProps = {
  title: string;
  submitLabel: string;
  name: string;
  onNameChange: (value: string) => void;
  color?: string;
  colors?: string[];
  onColorChange?: (value: string) => void;
  error?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function CalendarDialog({
  title,
  submitLabel,
  name,
  onNameChange,
  color,
  colors,
  onColorChange,
  error,
  saving,
  onClose,
  onSubmit,
}: CalendarDialogProps) {
  const palette = Array.isArray(colors) ? colors : [];
  const showColorPicker =
    palette.length > 0 && typeof onColorChange === "function" && !!color;

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            X
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Name
            </p>
            <input
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Calendar name"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/40"
            />
          </div>
          {showColorPicker && (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Color
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {palette.map((swatch) => {
                  const isActive = swatch === color;
                  return (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => onColorChange?.(swatch)}
                      className={classNames(
                        "h-7 w-7 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                        isActive ? "border-white" : "border-white/20",
                      )}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select ${swatch}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
