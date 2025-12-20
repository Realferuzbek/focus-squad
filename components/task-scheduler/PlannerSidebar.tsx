"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Eye,
  EyeOff,
  List as ListIcon,
  MoreHorizontal,
} from "lucide-react";
import type {
  TaskCalendar,
  TaskPrivateItem,
  TaskPrivateItemKind,
} from "@/lib/taskSchedulerTypes";

type Section = "home" | "private" | "settings";
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
  calendars,
  calendarsLoading,
  onCreateCalendar,
  onUpdateCalendar,
  onDeleteCalendar,
  workspaceTitle,
}: PlannerSidebarProps) {
  const homeItem = navItems.find((item) => item.id === "home");
  const privateItem = navItems.find((item) => item.id === "private");
  const settingsItem = navItems.find((item) => item.id === "settings");
  const workspaceName = workspaceTitle?.trim() || "Workspace";
  const workspaceInitial = workspaceName[0]?.toUpperCase() || "W";

  const isHomeActive = activeSection === "home";
  const isPlannerActive = activeSection === "private";
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!renameTarget) return;
    setRenameDraft(renameTarget.name);
    setRenameError(null);
  }, [renameTarget]);

  useEffect(() => {
    if (!menuOpenId) {
      menuWrapperRef.current = null;
      return;
    }
    function handleClick(event: MouseEvent) {
      if (menuWrapperRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenuOpenId(null);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpenId(null);
      }
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpenId]);

  const handlePrivateSelect = (id: string) => {
    onSelectPrivateItem(id);
    if (activeSection !== "private") {
      onSectionChange("private");
    }
  };

  const handleAddPrivateItem = () => {
    onAddPrivateItem();
    if (activeSection !== "private") {
      onSectionChange("private");
    }
  };

  const handleOpenCreateCalendar = () => {
    setCreateCalendarName("");
    setCreateCalendarColor(CALENDAR_COLORS[0]);
    setCreateCalendarError(null);
    setCreateCalendarOpen(true);
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

  async function handleToggleVisibility(calendar: TaskCalendar) {
    try {
      await onUpdateCalendar(calendar.id, {
        isVisible: !calendar.isVisible,
      });
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to update visibility",
      );
    }
  }

  async function handleSetDefault(calendar: TaskCalendar) {
    if (calendar.isDefault) return;
    try {
      await onUpdateCalendar(calendar.id, { isDefault: true });
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to set default",
      );
    }
  }

  async function handleDelete(calendar: TaskCalendar) {
    const confirmed = window.confirm(
      calendar.isDefault
        ? "Delete the default calendar? Events will move to another calendar."
        : "Delete this calendar?",
    );
    if (!confirmed) return;
    try {
      await onDeleteCalendar(calendar.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete calendar");
    }
  }

  return (
    <>
      <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-[#0c0c16] p-4">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold uppercase text-white/80">
            {workspaceInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {workspaceName}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Workspace menu"
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <input
          type="text"
          placeholder="Search"
          aria-label="Search"
          className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
        />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          Navigation
        </p>
        <div className="mt-2 space-y-1">
          <button
            type="button"
            onClick={() => onSectionChange("home")}
            title={homeItem?.description}
            className={classNames(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              isHomeActive
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-base">
              {homeItem?.icon ?? "H"}
            </span>
            <span className="font-medium">{homeItem?.label ?? "Home"}</span>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange("private")}
            title={privateItem?.description}
            className={classNames(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              isPlannerActive
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5">
              <ListIcon className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-medium">Planner</span>
          </button>
          <button
            type="button"
            onClick={() => onSurfaceChange("calendar")}
            className={classNames(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              isCalendarActive
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5">
              <CalendarIcon className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-medium">Calendar</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              {privateItem?.label ?? "Private"}
            </p>
            <div className="mt-2 space-y-1">
              {privateLoading ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                  Loading private items...
                </div>
              ) : privateError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {privateError}
                </div>
              ) : privateItems.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
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
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-base">
                        {meta.icon}
                      </span>
                      <span className="truncate">{item.title}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-white/40">
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
              className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
            >
              + Add new
            </button>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              CALENDARS
            </p>
            <div className="mt-2 space-y-1">
              {calendarsLoading ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                  Loading calendars...
                </div>
              ) : calendars.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                  No calendars yet.
                </div>
              ) : (
                calendars.map((calendar) => {
                  const isMuted = !calendar.isVisible;
                  return (
                    <div
                      key={calendar.id}
                      className={classNames(
                        "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition",
                        isMuted
                          ? "text-white/40"
                          : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span
                        className={classNames(
                          "h-2.5 w-2.5 rounded-full",
                          isMuted && "opacity-40",
                        )}
                        style={{ backgroundColor: calendar.color }}
                        aria-hidden
                      />
                      <span className="truncate">{calendar.name}</span>
                      {calendar.isDefault && (
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-white/60">
                          Default
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(calendar)}
                          className={classNames(
                            "rounded-lg border border-white/10 p-2 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                            isMuted && "border-white/5 text-white/40",
                          )}
                          aria-label={
                            calendar.isVisible
                              ? "Hide calendar"
                              : "Show calendar"
                          }
                          title={
                            calendar.isVisible
                              ? "Hide calendar"
                              : "Show calendar"
                          }
                        >
                          {calendar.isVisible ? (
                            <Eye className="h-4 w-4" aria-hidden />
                          ) : (
                            <EyeOff className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                        <div
                          ref={(node) => {
                            if (menuOpenId === calendar.id) {
                              menuWrapperRef.current = node;
                            }
                          }}
                          className="relative"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setMenuOpenId((prev) =>
                                prev === calendar.id ? null : calendar.id,
                              )
                            }
                            className="rounded-lg border border-white/10 p-2 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                            aria-label="Calendar actions"
                            title="Calendar actions"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </button>
                          {menuOpenId === calendar.id && (
                            <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-white/10 bg-[#10101c] p-1 text-xs text-white shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setRenameTarget(calendar);
                                }}
                                className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-white/10"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  handleSetDefault(calendar);
                                }}
                                disabled={calendar.isDefault}
                                className={classNames(
                                  "w-full rounded-lg px-2 py-2 text-left transition hover:bg-white/10",
                                  calendar.isDefault && "cursor-not-allowed text-white/40",
                                )}
                              >
                                Set as default
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  handleDelete(calendar);
                                }}
                                className="w-full rounded-lg px-2 py-2 text-left text-rose-200 transition hover:bg-rose-500/10"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={handleOpenCreateCalendar}
              className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
            >
              + New calendar
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSectionChange("settings")}
            title={settingsItem?.description}
            className={classNames(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              isSettingsActive
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-base">
              {settingsItem?.icon ?? "S"}
            </span>
            <span className="font-medium">
              {settingsItem?.label ?? "Settings"}
            </span>
          </button>
          <button
            type="button"
            aria-disabled="true"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/40"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-xs font-semibold text-white/40">
              T
            </span>
            <span className="font-medium">Trash</span>
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
