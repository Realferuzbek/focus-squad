"use client";

import { Calendar as CalendarIcon, ChevronDown, List as ListIcon } from "lucide-react";
import type { TaskPrivateItem, TaskPrivateItemKind } from "@/lib/taskSchedulerTypes";

type Section = "home" | "private" | "settings";
type SurfaceView = "planner" | "calendar";

type NavItem = {
  id: Section;
  label: string;
  description: string;
  icon: string;
};

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

  return (
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
          className="rounded-lg border border-white/10 bg-white/5 p-1 text-white/60 transition hover:text-white"
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          {privateItem?.label ?? "Private"}
        </p>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
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
  );
}
