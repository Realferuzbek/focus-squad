"use client";

import NextImage from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Image as ImageIcon,
  Loader2,
  Search,
  Upload,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabaseClient";
import { csrfFetch } from "@/lib/csrf-client";
import type {
  AdminCandidate,
  ListedAdmin,
  ListedMember,
  ListedRemoved,
} from "@/lib/live/admin";

type TabKey = "general" | "members" | "removed" | "appearance" | "admins" | "recent";

type AdminStateUpdatePayload = {
  groupName: string;
  groupDescription: string | null;
  groupAvatarUrl: string | null;
  wallpaperUrl: string | null;
};

type AuditEntry = {
  id: number;
  at: string;
  action: string;
  actor: string | null;
  targetUser: string | null;
  messageId: number | null;
  fromText: string | null;
  toText: string | null;
  actorProfile?: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  targetProfile?: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
};

type LiveAdminDrawerProps = {
  open: boolean;
  activeTab: TabKey;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: TabKey) => void;
  viewerId: string;
  state: {
    groupName: string;
    groupDescription: string | null;
    groupAvatarUrl: string | null;
    wallpaperUrl: string | null;
    subscribersCount: number;
    isLive: boolean;
    activeMembers: number;
    removedMembers: number;
  };
  saving: boolean;
  onSave: (payload: AdminStateUpdatePayload) => Promise<boolean>;
  onError: (message: string) => void;
  onNotice?: (message: string, variant?: "success" | "info" | "error") => void;
  onRefresh: () => Promise<void>;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "general", label: "General" },
  { key: "members", label: "Members" },
  { key: "removed", label: "Removed" },
  { key: "appearance", label: "Appearance" },
  { key: "admins", label: "Admins" },
  { key: "recent", label: "Recent actions" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function getFocusable(root: HTMLElement | null) {
  if (!root) return [] as HTMLElement[];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const styles = window.getComputedStyle(element);
    return styles.visibility !== "hidden" && styles.display !== "none";
  });
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const AVATAR_PREVIEW_SIZE = 224;
const AVATAR_EXPORT_SIZE = 1024;
const WALLPAPER_PREVIEW_WIDTH = 360;
const WALLPAPER_PREVIEW_HEIGHT = 202;
const WALLPAPER_EXPORT_WIDTH = 1920;
const WALLPAPER_EXPORT_HEIGHT = 1080;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    img.src = objectUrl;
  });
}

function buildPublicUrl(path: string, explicit?: string | null) {
  if (explicit) return explicit;
  if (!SUPABASE_URL) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/live_assets/${path}`;
}

type AvatarCropState = {
  zoom: number;
  centerX: number;
  centerY: number;
};

type WallpaperCropState = {
  zoom: number;
  centerX: number;
  centerY: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
  cropWidth: number;
  cropHeight: number;
  previewWidth: number;
  previewHeight: number;
};

function resolveAvatarRect(image: HTMLImageElement, crop: AvatarCropState) {
  const baseSize = Math.min(image.width, image.height);
  const cropSize = baseSize / crop.zoom;
  const half = cropSize / 2;
  const centerX = clamp(crop.centerX, half, image.width - half);
  const centerY = clamp(crop.centerY, half, image.height - half);
  return {
    cropX: centerX - half,
    cropY: centerY - half,
    cropSize,
    centerX,
    centerY,
  };
}

function drawAvatarPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: AvatarCropState,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { cropX, cropY, cropSize } = resolveAvatarRect(image, crop);
  if (canvas.width !== AVATAR_PREVIEW_SIZE) {
    canvas.width = AVATAR_PREVIEW_SIZE;
    canvas.height = AVATAR_PREVIEW_SIZE;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
}

function getWallpaperBase(image: HTMLImageElement) {
  const ratio = 16 / 9;
  const imageRatio = image.width / image.height;
  if (imageRatio >= ratio) {
    const baseHeight = image.height;
    return { baseWidth: baseHeight * ratio, baseHeight };
  }
  const baseWidth = image.width;
  return { baseWidth, baseHeight: baseWidth / ratio };
}

function resolveWallpaperRect(image: HTMLImageElement, crop: WallpaperCropState) {
  const { baseWidth, baseHeight } = getWallpaperBase(image);
  const cropWidth = baseWidth / crop.zoom;
  const cropHeight = baseHeight / crop.zoom;
  const halfW = cropWidth / 2;
  const halfH = cropHeight / 2;
  const centerX = clamp(crop.centerX, halfW, image.width - halfW);
  const centerY = clamp(crop.centerY, halfH, image.height - halfH);
  return {
    cropX: centerX - halfW,
    cropY: centerY - halfH,
    cropWidth,
    cropHeight,
    centerX,
    centerY,
  };
}

function drawWallpaperPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: WallpaperCropState,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { cropX, cropY, cropWidth, cropHeight } = resolveWallpaperRect(image, crop);
  if (canvas.width !== WALLPAPER_PREVIEW_WIDTH) {
    canvas.width = WALLPAPER_PREVIEW_WIDTH;
    canvas.height = WALLPAPER_PREVIEW_HEIGHT;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

async function exportAvatarFile(
  image: HTMLImageElement,
  crop: AvatarCropState,
): Promise<File> {
  const { cropX, cropY, cropSize } = resolveAvatarRect(image, crop);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EXPORT_SIZE;
  canvas.height = AVATAR_EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas");
  }
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_EXPORT_SIZE,
    AVATAR_EXPORT_SIZE,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.95),
  );
  if (!blob) {
    throw new Error("avatar-blob");
  }
  return new File([blob], `avatar-${Date.now()}.webp`, { type: "image/webp" });
}

async function exportWallpaperFile(
  image: HTMLImageElement,
  crop: WallpaperCropState,
): Promise<File> {
  const { cropX, cropY, cropWidth, cropHeight } = resolveWallpaperRect(image, crop);
  const canvas = document.createElement("canvas");
  canvas.width = WALLPAPER_EXPORT_WIDTH;
  canvas.height = WALLPAPER_EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas");
  }
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    WALLPAPER_EXPORT_WIDTH,
    WALLPAPER_EXPORT_HEIGHT,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) {
    throw new Error("wallpaper-blob");
  }
  return new File([blob], `wallpaper-${Date.now()}.webp`, { type: "image/webp" });
}

function getInitial(displayName: string | null, email: string | null) {
  const source = displayName?.trim() || email?.trim() || "";
  if (!source) return "?";
  return source[0]?.toUpperCase() ?? "?";
}

type MemberAvatarProps = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

function MemberAvatar({ name, email, avatarUrl }: MemberAvatarProps) {
  const initial = getInitial(name, email);
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white/10">
      {avatarUrl ? (
        <NextImage
          src={avatarUrl}
          alt={name ?? email ?? "Member avatar"}
          fill
          className="object-cover"
          sizes="40px"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">
          {initial}
        </div>
      )}
    </div>
  );
}

type AuditFilter = "all" | "messages" | "members" | "settings";

const AUDIT_FILTERS: Array<{ key: AuditFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "messages", label: "Messages" },
  { key: "members", label: "Members" },
  { key: "settings", label: "Settings" },
];

const AUDIT_FILTER_LABEL: Record<AuditFilter, string> = {
  all: "General",
  messages: "Messages",
  members: "Members",
  settings: "Settings",
};

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatRelativeTime(iso: string) {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const now = Date.now();
  const diffMs = target - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) {
    return RELATIVE_TIME_FORMAT.format(Math.round(diffSeconds / 1), "second");
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_TIME_FORMAT.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_TIME_FORMAT.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return RELATIVE_TIME_FORMAT.format(diffDays, "day");
  }
  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 4) {
    return RELATIVE_TIME_FORMAT.format(diffWeeks, "week");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return RELATIVE_TIME_FORMAT.format(diffMonths, "month");
  }
  const diffYears = Math.round(diffDays / 365);
  return RELATIVE_TIME_FORMAT.format(diffYears, "year");
}

function displayName(
  profile: { displayName: string | null } | null | undefined,
  fallback: string | null | undefined,
) {
  return profile?.displayName?.trim() || fallback || "Someone";
}

function truncateText(text: string, limit = 140) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function categorizeAction(action: string): AuditFilter {
  if (action.startsWith("message." ) || action.startsWith("message_")) {
    return "messages";
  }
  if (action.startsWith("members.") || action.startsWith("member_")) {
    return "members";
  }
  if (
    action.startsWith("settings.") ||
    action.startsWith("admin_") ||
    action === "state_update"
  ) {
    return "settings";
  }
  return "all";
}

function summarizeAuditEntry(entry: AuditEntry) {
  const actorName = displayName(entry.actorProfile, entry.actor);
  const targetName = displayName(entry.targetProfile, entry.targetUser);
  switch (entry.action) {
    case "message.delete": {
      if (entry.actor === entry.targetUser || !entry.targetUser) {
        return `${actorName} deleted a message`;
      }
      return `${actorName} deleted ${targetName}'s message`;
    }
    case "message.edit": {
      if (entry.actor === entry.targetUser || !entry.targetUser) {
        return `${actorName} edited a message`;
      }
      return `${actorName} edited ${targetName}'s message`;
    }
    case "message_delete": {
      if (entry.actor === entry.targetUser || !entry.targetUser) {
        return `${actorName} deleted a message`;
      }
      return `${actorName} deleted ${targetName}'s message`;
    }
    case "message_edit": {
      if (entry.actor === entry.targetUser || !entry.targetUser) {
        return `${actorName} edited a message`;
      }
      return `${actorName} edited ${targetName}'s message`;
    }
    case "members.remove":
    case "member_remove":
      return `${actorName} removed ${targetName}`;
    case "members.restore":
    case "member_restore":
      return `${actorName} restored ${targetName}`;
    case "settings.group_name":
      return `${actorName} renamed the group`;
    case "settings.description":
      return `${actorName} updated the description`;
    case "settings.avatar":
      return `${actorName} updated the avatar`;
    case "settings.wallpaper":
      return `${actorName} set the wallpaper`;
    case "settings.admin.add":
    case "admin_add":
      return `${actorName} granted admin to ${targetName}`;
    case "settings.admin.remove":
    case "admin_remove":
      return `${actorName} removed admin from ${targetName}`;
    case "state_update":
      return `${actorName} updated the live stream settings`;
    default:
      return `${actorName} updated the live chat`;
  }
}

export default function LiveAdminDrawer({
  open,
  activeTab,
  onOpenChange,
  onTabChange,
  viewerId,
  state,
  onSave,
  onError,
  onNotice,
  onRefresh,
  saving,
}: LiveAdminDrawerProps) {
  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const [nameInput, setNameInput] = useState(state.groupName);
  const [descriptionInput, setDescriptionInput] = useState(state.groupDescription ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(state.groupAvatarUrl ?? null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(state.wallpaperUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);

  const [avatarEditor, setAvatarEditor] = useState<{
    image: HTMLImageElement;
    file: File;
  } | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<AvatarCropState | null>(null);
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const avatarDragRef = useRef<DragState | null>(null);

  const [wallpaperEditor, setWallpaperEditor] = useState<{
    image: HTMLImageElement;
    file: File;
  } | null>(null);
  const [wallpaperCrop, setWallpaperCrop] = useState<WallpaperCropState | null>(null);
  const wallpaperCanvasRef = useRef<HTMLCanvasElement>(null);
  const wallpaperDragRef = useRef<DragState | null>(null);

  const [members, setMembers] = useState<ListedMember[]>([]);
  const [membersCursor, setMembersCursor] = useState<string | null>(null);
  const [membersHasMore, setMembersHasMore] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersSearchValue, setMembersSearchValue] = useState("");
  const [membersQuery, setMembersQuery] = useState("");
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const [removed, setRemoved] = useState<ListedRemoved[]>([]);
  const [removedCursor, setRemovedCursor] = useState<string | null>(null);
  const [removedHasMore, setRemovedHasMore] = useState(false);
  const [removedLoading, setRemovedLoading] = useState(false);
  const [removedSearchValue, setRemovedSearchValue] = useState("");
  const [removedQuery, setRemovedQuery] = useState("");
  const [removedActionId, setRemovedActionId] = useState<string | null>(null);

  const [admins, setAdmins] = useState<ListedAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMatches, setAdminMatches] = useState<AdminCandidate[]>([]);
  const [adminMatchesLoading, setAdminMatchesLoading] = useState(false);
  const [adminSearchValue, setAdminSearchValue] = useState("");
  const [adminQuery, setAdminQuery] = useState("");
  const [adminActionId, setAdminActionId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<
    | {
        type: "member" | "admin";
        userId: string;
        name: string;
        body: string;
      }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const membersParentRef = useRef<HTMLDivElement>(null);
  const removedParentRef = useRef<HTMLDivElement>(null);

const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
const [auditCursor, setAuditCursor] = useState<string | null>(null);
const [auditHasMore, setAuditHasMore] = useState(false);
const [auditLoading, setAuditLoading] = useState(false);
const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
const auditParentRef = useRef<HTMLDivElement>(null);

  const membersVirtualizer = useVirtualizer({
    count: currentTab === "members"
      ? members.length + (membersHasMore || membersLoading ? 1 : 0)
      : 0,
    getScrollElement: () => membersParentRef.current,
    estimateSize: () => 88,
    overscan: 6,
  });
  const memberVirtualItems = membersVirtualizer.getVirtualItems();

  const removedVirtualizer = useVirtualizer({
    count: currentTab === "removed"
      ? removed.length + (removedHasMore || removedLoading ? 1 : 0)
      : 0,
    getScrollElement: () => removedParentRef.current,
    estimateSize: () => 88,
    overscan: 6,
  });
  const removedVirtualItems = removedVirtualizer.getVirtualItems();

  const adminIdSet = useMemo(() => new Set(admins.map((admin) => admin.userId)), [admins]);
  const lastAdminId = admins.length === 1 ? admins[0]?.userId ?? null : null;

  const auditVirtualizer = useVirtualizer({
    count: currentTab === "recent"
      ? auditEntries.length + (auditHasMore || auditLoading ? 1 : 0)
      : 0,
    getScrollElement: () => auditParentRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });
  const auditVirtualItems = auditVirtualizer.getVirtualItems();

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (currentTab !== activeTab) {
      onTabChange(currentTab);
    }
  }, [currentTab, activeTab, onTabChange]);

  useEffect(() => {
    if (!open) return;
    setNameInput(state.groupName);
    setDescriptionInput(state.groupDescription ?? "");
    setAvatarUrl(state.groupAvatarUrl ?? null);
    setWallpaperUrl(state.wallpaperUrl ?? null);
  }, [open, state.groupAvatarUrl, state.groupDescription, state.groupName, state.wallpaperUrl]);

  useEffect(() => {
    if (open) return;
    avatarDragRef.current = null;
    wallpaperDragRef.current = null;
    setAvatarEditor(null);
    setAvatarCrop(null);
    setWallpaperEditor(null);
    setWallpaperCrop(null);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setPrefersReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (!avatarEditor || !avatarCrop) return;
    const canvas = avatarCanvasRef.current;
    if (!canvas) return;
    drawAvatarPreview(canvas, avatarEditor.image, avatarCrop);
  }, [avatarEditor, avatarCrop]);

  useEffect(() => {
    if (!wallpaperEditor || !wallpaperCrop) return;
    const canvas = wallpaperCanvasRef.current;
    if (!canvas) return;
    drawWallpaperPreview(canvas, wallpaperEditor.image, wallpaperCrop);
  }, [wallpaperEditor, wallpaperCrop]);

  const descriptionWords = useMemo(() => {
    const trimmed = descriptionInput.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [descriptionInput]);

  const applyAvatarCrop = useCallback(
    (mutator: (prev: AvatarCropState) => AvatarCropState) => {
      if (!avatarEditor) return;
      setAvatarCrop((prev) => {
        const base = prev ?? {
          zoom: 1,
          centerX: avatarEditor.image.width / 2,
          centerY: avatarEditor.image.height / 2,
        };
        const next = mutator(base);
        const resolved = resolveAvatarRect(avatarEditor.image, next);
        return {
          zoom: next.zoom,
          centerX: resolved.centerX,
          centerY: resolved.centerY,
        };
      });
    },
    [avatarEditor],
  );

  const applyWallpaperCrop = useCallback(
    (mutator: (prev: WallpaperCropState) => WallpaperCropState) => {
      if (!wallpaperEditor) return;
      setWallpaperCrop((prev) => {
        const base = prev ?? {
          zoom: 1,
          centerX: wallpaperEditor.image.width / 2,
          centerY: wallpaperEditor.image.height / 2,
        };
        const next = mutator(base);
        const resolved = resolveWallpaperRect(wallpaperEditor.image, next);
        return {
          zoom: next.zoom,
          centerX: resolved.centerX,
          centerY: resolved.centerY,
        };
      });
    },
    [wallpaperEditor],
  );

  const normalizedDescription = descriptionInput.trim() ? descriptionInput.trim() : null;
  const baselineDescription = state.groupDescription ? state.groupDescription.trim() : null;
  const generalDirty =
    nameInput.trim() !== state.groupName || normalizedDescription !== baselineDescription;
  const appearanceDirty =
    (avatarUrl ?? null) !== (state.groupAvatarUrl ?? null) ||
    (wallpaperUrl ?? null) !== (state.wallpaperUrl ?? null);

  const canSaveGeneral =
    currentTab === "general" && generalDirty && !saving && !avatarUploading && !wallpaperUploading;
  const canSaveAppearance =
    currentTab === "appearance" &&
    appearanceDirty &&
    !saving &&
    !avatarUploading &&
    !wallpaperUploading;

  const signAndUpload = useCallback(
    async (file: File, variant: "avatar" | "wallpaper") => {
      const res = await csrfFetch(`/api/community/live/admin/${variant}/sign-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type,
          bytes: file.size,
          variant,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "sign");
      }
      const data = await res.json();
      const { error } = await supabaseBrowser.storage
        .from("live_assets")
        .uploadToSignedUrl(data.path, data.token, file);
      if (error) {
        throw error;
      }
      return buildPublicUrl(data.path, data.publicUrl);
    },
    [],
  );

  const persistState = useCallback(
    async (payload: Partial<AdminStateUpdatePayload>) => {
      const res = await csrfFetch("/api/community/live/admin/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "state");
      }
      await onRefresh();
    },
    [onRefresh],
  );

  const handleAvatarFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        onError("Please choose a JPG, PNG, or WEBP image.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        onError("Images must be 3 MB or smaller.");
        return;
      }
      try {
        const image = await loadImageElement(file);
        setAvatarEditor({ image, file });
        setAvatarCrop({
          zoom: 1,
          centerX: image.width / 2,
          centerY: image.height / 2,
        });
      } catch (error) {
        console.error("avatar load", error);
        onError("Unable to open that image. Please try another file.");
      }
    },
    [onError],
  );

  const handleWallpaperFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        onError("Please choose a JPG, PNG, or WEBP image.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        onError("Images must be 3 MB or smaller.");
        return;
      }
      try {
        const image = await loadImageElement(file);
        setWallpaperEditor({ image, file });
        setWallpaperCrop({
          zoom: 1,
          centerX: image.width / 2,
          centerY: image.height / 2,
        });
      } catch (error) {
        console.error("wallpaper load", error);
        onError("Unable to open that image. Please try another file.");
      }
    },
    [onError],
  );

  const resetAvatarCrop = useCallback(() => {
    if (!avatarEditor) return;
    setAvatarCrop({
      zoom: 1,
      centerX: avatarEditor.image.width / 2,
      centerY: avatarEditor.image.height / 2,
    });
  }, [avatarEditor]);

  const resetWallpaperCrop = useCallback(() => {
    if (!wallpaperEditor) return;
    setWallpaperCrop({
      zoom: 1,
      centerX: wallpaperEditor.image.width / 2,
      centerY: wallpaperEditor.image.height / 2,
    });
  }, [wallpaperEditor]);

  const handleAvatarCancelEdit = useCallback(() => {
    avatarDragRef.current = null;
    setAvatarEditor(null);
    setAvatarCrop(null);
  }, []);

  const handleWallpaperCancelEdit = useCallback(() => {
    wallpaperDragRef.current = null;
    setWallpaperEditor(null);
    setWallpaperCrop(null);
  }, []);

  const handleAvatarUpload = useCallback(async () => {
    if (!avatarEditor || !avatarCrop) return;
    try {
      setAvatarUploading(true);
      const file = await exportAvatarFile(avatarEditor.image, avatarCrop);
      const uploadedUrl = await signAndUpload(file, "avatar");
      await persistState({ groupAvatarUrl: uploadedUrl });
      setAvatarUrl(uploadedUrl);
      avatarDragRef.current = null;
      setAvatarEditor(null);
      setAvatarCrop(null);
      onNotice?.("Group avatar updated.", "success");
    } catch (error) {
      console.error("avatar save", error);
      onError("Failed to save avatar. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarCrop, avatarEditor, onError, onNotice, persistState, signAndUpload]);

  const handleWallpaperUpload = useCallback(async () => {
    if (!wallpaperEditor || !wallpaperCrop) return;
    try {
      setWallpaperUploading(true);
      const file = await exportWallpaperFile(wallpaperEditor.image, wallpaperCrop);
      const uploadedUrl = await signAndUpload(file, "wallpaper");
      await persistState({ wallpaperUrl: uploadedUrl });
      setWallpaperUrl(uploadedUrl);
      wallpaperDragRef.current = null;
      setWallpaperEditor(null);
      setWallpaperCrop(null);
      onNotice?.("Wallpaper updated.", "success");
    } catch (error) {
      console.error("wallpaper save", error);
      onError("Failed to save wallpaper. Please try again.");
    } finally {
      setWallpaperUploading(false);
    }
  }, [onError, onNotice, persistState, signAndUpload, wallpaperCrop, wallpaperEditor]);

  const handleAvatarRemove = useCallback(async () => {
    if (avatarUploading) return;
    try {
      setAvatarUploading(true);
      await persistState({ groupAvatarUrl: null });
      setAvatarUrl(null);
      avatarDragRef.current = null;
      setAvatarEditor(null);
      setAvatarCrop(null);
      onNotice?.("Avatar removed.", "success");
    } catch (error) {
      console.error("avatar remove", error);
      onError("Failed to remove avatar. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUploading, onError, onNotice, persistState]);

  const handleWallpaperRemove = useCallback(async () => {
    if (wallpaperUploading) return;
    try {
      setWallpaperUploading(true);
      await persistState({ wallpaperUrl: null });
      setWallpaperUrl(null);
      wallpaperDragRef.current = null;
      setWallpaperEditor(null);
      setWallpaperCrop(null);
      onNotice?.("Wallpaper removed.", "success");
    } catch (error) {
      console.error("wallpaper remove", error);
      onError("Failed to remove wallpaper. Please try again.");
    } finally {
      setWallpaperUploading(false);
    }
  }, [onError, onNotice, persistState, wallpaperUploading]);

  const handleAvatarPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!avatarEditor || !avatarCrop) return;
      const canvas = event.currentTarget;
      canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      const { cropSize } = resolveAvatarRect(avatarEditor.image, avatarCrop);
      avatarDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        centerX: avatarCrop.centerX,
        centerY: avatarCrop.centerY,
        cropWidth: cropSize,
        cropHeight: cropSize,
        previewWidth: rect.width,
        previewHeight: rect.height,
      };
    },
    [avatarCrop, avatarEditor],
  );

  const handleAvatarPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = avatarDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const factorX = drag.cropWidth / drag.previewWidth;
      const factorY = drag.cropHeight / drag.previewHeight;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      applyAvatarCrop((prev) => ({
        ...prev,
        centerX: drag.centerX - deltaX * factorX,
        centerY: drag.centerY - deltaY * factorY,
      }));
    },
    [applyAvatarCrop],
  );

  const handleAvatarPointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (avatarDragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      avatarDragRef.current = null;
    }
  }, []);

  const handleWallpaperPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!wallpaperEditor || !wallpaperCrop) return;
      const canvas = event.currentTarget;
      canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      const { cropWidth, cropHeight } = resolveWallpaperRect(
        wallpaperEditor.image,
        wallpaperCrop,
      );
      wallpaperDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        centerX: wallpaperCrop.centerX,
        centerY: wallpaperCrop.centerY,
        cropWidth,
        cropHeight,
        previewWidth: rect.width,
        previewHeight: rect.height,
      };
    },
    [wallpaperCrop, wallpaperEditor],
  );

  const handleWallpaperPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = wallpaperDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const factorX = drag.cropWidth / drag.previewWidth;
      const factorY = drag.cropHeight / drag.previewHeight;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      applyWallpaperCrop((prev) => ({
        ...prev,
        centerX: drag.centerX - deltaX * factorX,
        centerY: drag.centerY - deltaY * factorY,
      }));
    },
    [applyWallpaperCrop],
  );

  const handleWallpaperPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (wallpaperDragRef.current?.pointerId === event.pointerId) {
        event.currentTarget.releasePointerCapture(event.pointerId);
        wallpaperDragRef.current = null;
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (currentTab !== "general" && currentTab !== "appearance") return;
    if (
      (currentTab === "general" && !generalDirty) ||
      (currentTab === "appearance" && !appearanceDirty)
    ) {
      onOpenChange(false);
      return;
    }
    const normalizedName = nameInput.trim() || "Live Stream Chat";
    const payload: AdminStateUpdatePayload = {
      groupName: normalizedName,
      groupDescription: normalizedDescription,
      groupAvatarUrl: avatarUrl,
      wallpaperUrl,
    };
    const success = await onSave(payload);
    if (success) {
      await onRefresh();
      onOpenChange(false);
    }
  }, [
    appearanceDirty,
    avatarUrl,
    currentTab,
    generalDirty,
    nameInput,
    normalizedDescription,
    onOpenChange,
    onRefresh,
    onSave,
    wallpaperUrl,
  ]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s" &&
        (currentTab === "general" || currentTab === "appearance")
      ) {
        event.preventDefault();
        void handleSave();
        return;
      }
      if (event.key === "Tab") {
        const focusables = getFocusable(containerRef.current);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const focusables = getFocusable(containerRef.current);
    if (focusables.length) {
      focusables[0].focus();
    } else {
      containerRef.current?.focus();
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [currentTab, handleSave, open, onOpenChange]);

  useEffect(() => {
    const trimmed = membersSearchValue.trim();
    const handle = window.setTimeout(() => {
      setMembersCursor(null);
      setMembersQuery((prev) => (prev === trimmed ? prev : trimmed));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [membersSearchValue]);

  useEffect(() => {
    const trimmed = removedSearchValue.trim();
    const handle = window.setTimeout(() => {
      setRemovedCursor(null);
      setRemovedQuery((prev) => (prev === trimmed ? prev : trimmed));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [removedSearchValue]);

  useEffect(() => {
    const trimmed = adminSearchValue.trim();
    const handle = window.setTimeout(() => {
      setAdminQuery((prev) => (prev === trimmed ? prev : trimmed));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [adminSearchValue]);

  useEffect(() => {
    if (currentTab !== "members") return;
    membersParentRef.current?.scrollTo({ top: 0 });
  }, [currentTab, membersQuery]);

  useEffect(() => {
    if (currentTab !== "removed") return;
    removedParentRef.current?.scrollTo({ top: 0 });
  }, [currentTab, removedQuery]);

  const loadMembers = useCallback(
    async (reset: boolean) => {
      if (!open) return;
      if (membersLoading) return;
      setMembersLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (!reset && membersCursor) {
          params.set("cursor", membersCursor);
        }
        if (membersQuery) {
          params.set("q", membersQuery);
        }
        const res = await fetch(
          `/api/community/live/admin/members?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("members");
        }
        const data: {
          items: ListedMember[];
          nextCursor: string | null;
          hasMore: boolean;
        } = await res.json();
        setMembers((prev) => (reset ? data.items : [...prev, ...data.items]));
        setMembersHasMore(data.hasMore);
        setMembersCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("load members", error);
        onError("Unable to load members right now.");
      } finally {
        setMembersLoading(false);
      }
    },
    [membersCursor, membersLoading, membersQuery, onError, open],
  );

  const loadRemoved = useCallback(
    async (reset: boolean) => {
      if (!open) return;
      if (removedLoading) return;
      setRemovedLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (!reset && removedCursor) {
          params.set("cursor", removedCursor);
        }
        if (removedQuery) {
          params.set("q", removedQuery);
        }
        const res = await fetch(
          `/api/community/live/admin/removed?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("removed");
        }
        const data: {
          items: ListedRemoved[];
          nextCursor: string | null;
          hasMore: boolean;
        } = await res.json();
        setRemoved((prev) => (reset ? data.items : [...prev, ...data.items]));
        setRemovedHasMore(data.hasMore);
        setRemovedCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("load removed", error);
        onError("Unable to load removed members.");
      } finally {
        setRemovedLoading(false);
      }
    },
    [onError, open, removedCursor, removedLoading, removedQuery],
  );

  useEffect(() => {
    if (currentTab !== "members") return;
    if (!membersHasMore || membersLoading) return;
    const parent = membersParentRef.current;
    if (!parent) return;
    const virtualItems = memberVirtualItems;
    if (!virtualItems.length) return;
    const distance = parent.scrollHeight - (parent.scrollTop + parent.clientHeight);
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index < members.length && distance >= 200) return;
    void loadMembers(false);
  }, [
    currentTab,
    loadMembers,
    memberVirtualItems,
    members.length,
    membersHasMore,
    membersLoading,
  ]);

  useEffect(() => {
    if (currentTab !== "removed") return;
    if (!removedHasMore || removedLoading) return;
    const parent = removedParentRef.current;
    if (!parent) return;
    const virtualItems = removedVirtualItems;
    if (!virtualItems.length) return;
    const distance = parent.scrollHeight - (parent.scrollTop + parent.clientHeight);
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index < removed.length && distance >= 200) return;
    void loadRemoved(false);
  }, [
    currentTab,
    loadRemoved,
    removed.length,
    removedHasMore,
    removedLoading,
    removedVirtualItems,
  ]);

  const loadAudit = useCallback(
    async (reset: boolean) => {
      if (!open) return;
      if (auditLoading) return;
      setAuditLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (!reset && auditCursor) {
          params.set("cursor", auditCursor);
        }
        if (auditFilter !== "all") {
          params.set("filter", auditFilter);
        }
        const res = await fetch(
          `/api/community/live/admin/audit?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("audit");
        }
        const data: {
          items: AuditEntry[];
          hasMore: boolean;
          nextCursor: string | null;
        } = await res.json();
        setAuditEntries((prev) => (reset ? data.items : [...prev, ...data.items]));
        setAuditHasMore(data.hasMore);
        setAuditCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("load audit", error);
        onError("Unable to load audit history.");
      } finally {
        setAuditLoading(false);
      }
    },
    [auditCursor, auditFilter, auditLoading, onError, open],
  );

  const loadAdmins = useCallback(async () => {
    if (!open) return;
    setAdminsLoading(true);
    try {
      const res = await fetch("/api/community/live/admin/admins", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("admins");
      }
      const data: { admins: ListedAdmin[] } = await res.json();
      setAdmins(data.admins ?? []);
    } catch (error) {
      console.error("load admins", error);
      onError("Unable to load admins right now.");
    } finally {
      setAdminsLoading(false);
    }
  }, [onError, open]);

  const refreshAdminSearch = useCallback(async () => {
    if (!open) {
      setAdminMatchesLoading(false);
      return;
    }
    if (currentTab !== "admins") {
      setAdminMatchesLoading(false);
      return;
    }
    if (!adminQuery) {
      setAdminMatches([]);
      setAdminMatchesLoading(false);
      return;
    }
    setAdminMatchesLoading(true);
    try {
      const params = new URLSearchParams({ q: adminQuery });
      const res = await fetch(`/api/community/live/admin/admins?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("admin-search");
      }
      const data: { admins: ListedAdmin[]; matches: AdminCandidate[] } = await res.json();
      setAdmins(data.admins ?? []);
      setAdminMatches(data.matches ?? []);
    } catch (error) {
      console.error("search admins", error);
      onError("Unable to search admins right now.");
    } finally {
      setAdminMatchesLoading(false);
    }
  }, [adminQuery, currentTab, onError, open]);

  useEffect(() => {
    if (!open) return;
    if (currentTab === "recent") {
      setAuditCursor(null);
      setAuditEntries([]);
      setAuditHasMore(false);
      void loadAudit(true);
    } else if (currentTab === "admins") {
      void loadAdmins();
    }
  }, [currentTab, loadAdmins, loadAudit, open]);

  useEffect(() => {
    if (!open || currentTab !== "members") return;
    void loadMembers(true);
  }, [currentTab, loadMembers, membersQuery, open]);

  useEffect(() => {
    if (!open || currentTab !== "removed") return;
    void loadRemoved(true);
  }, [currentTab, loadRemoved, open, removedQuery]);

  useEffect(() => {
    if (!open || currentTab !== "recent") return;
    setAuditCursor(null);
    setAuditEntries([]);
    setAuditHasMore(false);
    void loadAudit(true);
  }, [auditFilter, currentTab, loadAudit, open]);

  useEffect(() => {
    void refreshAdminSearch();
  }, [refreshAdminSearch]);

  useEffect(() => {
    if (currentTab !== "recent") return;
    if (!auditHasMore || auditLoading) return;
    const parent = auditParentRef.current;
    if (!parent) return;
    const virtualItems = auditVirtualizer.getVirtualItems();
    if (!virtualItems.length) return;
    const distance = parent.scrollHeight - (parent.scrollTop + parent.clientHeight);
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index < auditEntries.length && distance >= 200) return;
    void loadAudit(false);
  }, [
    auditEntries.length,
    auditHasMore,
    auditLoading,
    auditVirtualizer,
    currentTab,
    loadAudit,
  ]);

  const performRemoveMember = useCallback(
    async (userId: string) => {
      setMemberActionId(userId);
      const snapshotMembers = members;
      const snapshotRemoved = removed;
      const removedMember = members.find((member) => member.userId === userId) ?? null;
      setMembers((prev) => prev.filter((member) => member.userId !== userId));
      if (removedMember) {
        const optimisticRemoved: ListedRemoved = {
          userId,
          removedAt: new Date().toISOString(),
          displayName: removedMember.displayName,
          email: removedMember.email,
          avatarUrl: removedMember.avatarUrl,
        };
        setRemoved((prev) => [optimisticRemoved, ...prev]);
      }
      try {
        const res = await csrfFetch("/api/community/live/admin/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remove: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "remove");
        }
        onNotice?.("Member removed.", "success");
        await Promise.all([onRefresh(), loadMembers(true), loadRemoved(true)]);
      } catch (error) {
        console.error("remove member", error);
        setMembers(snapshotMembers);
        setRemoved(snapshotRemoved);
        onError("Failed to remove member.");
      } finally {
        setMemberActionId(null);
      }
    },
    [loadMembers, loadRemoved, members, onError, onNotice, onRefresh, removed],
  );

  const handleRemoveMember = useCallback(
    (member: ListedMember) => {
      setConfirmDialog({
        type: "member",
        userId: member.userId,
        name: member.displayName ?? member.email ?? "Member",
        body: "They will be unable to join until restored.",
      });
    },
    [],
  );

  const handleRestoreMember = useCallback(
    async (userId: string) => {
      setRemovedActionId(userId);
      const snapshotRemoved = removed;
      setRemoved((prev) => prev.filter((entry) => entry.userId !== userId));
      try {
        const res = await csrfFetch("/api/community/live/admin/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restore: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "restore");
        }
        onNotice?.("Member restored.", "success");
        await Promise.all([onRefresh(), loadMembers(true), loadRemoved(true)]);
      } catch (error) {
        console.error("restore member", error);
        setRemoved(snapshotRemoved);
        onError("Failed to restore member.");
      } finally {
        setRemovedActionId(null);
      }
    },
    [loadMembers, loadRemoved, onError, onNotice, onRefresh, removed],
  );

  const handleGrantAdmin = useCallback(
    async (userId: string) => {
      setAdminActionId(userId);
      const snapshotAdmins = admins;
      const snapshotMatches = adminMatches;
      const candidate =
        adminMatches.find((match) => match.userId === userId) ??
        admins.find((admin) => admin.userId === userId) ??
        null;
      if (!adminIdSet.has(userId)) {
        const optimistic: ListedAdmin = {
          userId,
          addedAt: new Date().toISOString(),
          displayName: candidate?.displayName ?? null,
          email: candidate?.email ?? null,
          avatarUrl: candidate?.avatarUrl ?? null,
        };
        setAdmins((prev) => [optimistic, ...prev]);
      }
      setAdminMatches((prev) =>
        prev.map((entry) =>
          entry.userId === userId
            ? {
                ...entry,
                isAdmin: true,
                addedAt: entry.addedAt ?? new Date().toISOString(),
              }
            : entry,
        ),
      );
      try {
        const res = await csrfFetch("/api/community/live/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ add: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "add");
        }
        onNotice?.("Admin access granted.", "success");
        await Promise.all([onRefresh(), loadAdmins()]);
        await refreshAdminSearch();
      } catch (error) {
        console.error("grant admin", error);
        setAdmins(snapshotAdmins);
        setAdminMatches(snapshotMatches);
        onError("Failed to grant admin access.");
      } finally {
        setAdminActionId(null);
      }
    },
    [
      adminMatches,
      adminIdSet,
      admins,
      loadAdmins,
      onError,
      onNotice,
      onRefresh,
      refreshAdminSearch,
    ],
  );

  const performRemoveAdmin = useCallback(
    async (userId: string) => {
      if (admins.length <= 1) {
        onError("You are the final admin. Add another admin before stepping down.");
        return;
      }
      setAdminActionId(userId);
      const snapshotAdmins = admins;
      const snapshotMatches = adminMatches;
      setAdmins((prev) => prev.filter((admin) => admin.userId !== userId));
      setAdminMatches((prev) =>
        prev.map((entry) =>
          entry.userId === userId
            ? { ...entry, isAdmin: false, addedAt: null }
            : entry,
        ),
      );
      try {
        const res = await csrfFetch("/api/community/live/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remove: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "remove");
        }
        onNotice?.("Admin access removed.", "success");
        await Promise.all([onRefresh(), loadAdmins()]);
        await refreshAdminSearch();
      } catch (error) {
        console.error("remove admin", error);
        setAdmins(snapshotAdmins);
        setAdminMatches(snapshotMatches);
        onError("Failed to update admin access.");
      } finally {
        setAdminActionId(null);
      }
    },
    [adminMatches, admins, loadAdmins, onError, onNotice, onRefresh, refreshAdminSearch],
  );

  const handleRemoveAdmin = useCallback(
    (admin: { userId: string; displayName: string | null; email: string | null }) => {
      if (admins.length <= 1 || (admin.userId === viewerId && admins.length <= 1)) {
        onError("You are the final admin. Add another admin before stepping down.");
        return;
      }
      setConfirmDialog({
        type: "admin",
        userId: admin.userId,
        name: admin.displayName ?? admin.email ?? "Admin",
        body: "You’ll lose access if this is the last admin.",
      });
    },
    [admins.length, onError, viewerId],
  );

  const handleConfirmCancel = useCallback(() => {
    if (confirmBusy) return;
    setConfirmDialog(null);
  }, [confirmBusy]);

  const handleConfirmSubmit = useCallback(async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    try {
      if (confirmDialog.type === "member") {
        await performRemoveMember(confirmDialog.userId);
      } else {
        await performRemoveAdmin(confirmDialog.userId);
      }
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmDialog, performRemoveAdmin, performRemoveMember]);

  const refreshCurrentTab = useCallback(() => {
    if (currentTab === "members") {
      void loadMembers(true);
    } else if (currentTab === "removed") {
      void loadRemoved(true);
    } else if (currentTab === "recent") {
      void loadAudit(true);
    } else if (currentTab === "admins") {
      void loadAdmins();
      void refreshAdminSearch();
    } else if (currentTab === "general" || currentTab === "appearance") {
      setNameInput(state.groupName);
      setDescriptionInput(state.groupDescription ?? "");
      setAvatarUrl(state.groupAvatarUrl ?? null);
      setWallpaperUrl(state.wallpaperUrl ?? null);
    }
  }, [
    currentTab,
    loadAudit,
    loadAdmins,
    loadMembers,
    loadRemoved,
    refreshAdminSearch,
    state.groupAvatarUrl,
    state.groupDescription,
    state.groupName,
    state.wallpaperUrl,
  ]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Live community admin"
        tabIndex={-1}
        className={`relative ml-0 sm:ml-auto flex h-full w-full flex-col rounded-t-3xl bg-[#080814] text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:max-w-[460px] sm:rounded-none sm:border-l sm:border-white/10 ${
          prefersReducedMotion ? "" : "transition duration-300"
        }`}
      >
        <header className="flex items-start justify-between border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Control</p>
            <h2 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">{state.groupName}</h2>
            <p className="mt-2 text-xs text-white/50">
              {state.subscribersCount.toLocaleString("en-US")} subscribers ·{" "}
              {state.isLive ? "Open" : "Locked"}
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Lock toggles with the Telegram live session.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close admin drawer"
            className="rounded-full border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav
          className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-3"
          role="tablist"
        >
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
            {TABS.map((tab) => {
              const selected = currentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  onClick={() => setCurrentTab(tab.key)}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                    selected
                      ? "bg-white text-[#090912]"
                      : "border border-white/10 text-white/70 hover:border-white/20 hover:text-white"
                  } flex-1 sm:flex-none`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 overflow-hidden px-4 py-6 sm:px-6">
          {currentTab === "general" && (
            <div className="h-full overflow-y-auto pr-1">
              <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-white/70" htmlFor="group-name">
                  Group name
                </label>
                <input
                  id="group-name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value.slice(0, 120))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white/70" htmlFor="group-description">
                    Description
                  </label>
                  <span className="text-xs text-white/40">{descriptionWords} / 40 words</span>
                </div>
                <textarea
                  id="group-description"
                  value={descriptionInput}
                  onChange={(event) => setDescriptionInput(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  placeholder="What should members feel when they join this space?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">Subscribers</p>
                  <p className="mt-2 text-xl font-semibold">
                    {state.subscribersCount.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">Status</p>
                  <p className="mt-2 text-xl font-semibold">{state.isLive ? "Open" : "Locked"}</p>
                </div>
              </div>
              </div>
            </div>
          )}

          {currentTab === "appearance" && (
            <div className="h-full overflow-y-auto pr-1">
              <div className="space-y-6">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Group avatar</h3>
                      <p className="text-xs text-white/50">Square · max 3&nbsp;MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {avatarEditor ? "Replace" : "Upload"}
                    </button>
                  </header>
                  <div className="mt-4 space-y-4">
                    {avatarEditor && avatarCrop ? (
                      <>
                        <div className="flex flex-col items-center gap-3">
                          <canvas
                            ref={avatarCanvasRef}
                            width={AVATAR_PREVIEW_SIZE}
                            height={AVATAR_PREVIEW_SIZE}
                            className="h-56 w-56 touch-none rounded-2xl border border-white/15 bg-black/40 shadow-inner cursor-grab active:cursor-grabbing"
                            onPointerDown={handleAvatarPointerDown}
                            onPointerMove={handleAvatarPointerMove}
                            onPointerUp={handleAvatarPointerUp}
                            onPointerLeave={handleAvatarPointerUp}
                          />
                          <p className="text-xs text-white/40">Drag to reposition · adjust zoom below</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={4}
                            step={0.01}
                            value={avatarCrop.zoom}
                            onChange={(event) =>
                              applyAvatarCrop((prev) => ({
                                ...prev,
                                zoom: Number(event.target.value),
                              }))
                            }
                            className="flex-1 accent-violet-400"
                          />
                          <button
                            type="button"
                            onClick={resetAvatarCrop}
                            className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handleAvatarCancelEdit}
                            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAvatarUpload}
                            disabled={avatarUploading}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#080814] transition hover:bg-white/80 disabled:opacity-60"
                          >
                            {avatarUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Save avatar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                          {avatarUrl ? (
                            <NextImage
                              src={avatarUrl}
                              alt="Group avatar"
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/40">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-white/60">
                          <span>Recommended: crisp square PNG or photo with transparent background.</span>
                          {avatarUrl ? (
                            <button
                              type="button"
                              onClick={handleAvatarRemove}
                              disabled={avatarUploading}
                              className="self-start rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {avatarUploading ? "Removing…" : "Remove avatar"}
                            </button>
                          ) : (
                            <span className="text-white/40">No avatar yet.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <header className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Wallpaper</h3>
                      <p className="text-xs text-white/50">16:9 crop · max 3&nbsp;MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => wallpaperInputRef.current?.click()}
                      disabled={wallpaperUploading}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {wallpaperEditor ? "Replace" : "Upload"}
                    </button>
                  </header>
                  <div className="mt-4 space-y-4">
                    {wallpaperEditor && wallpaperCrop ? (
                      <>
                        <div className="flex flex-col items-center gap-3">
                          <canvas
                            ref={wallpaperCanvasRef}
                            width={WALLPAPER_PREVIEW_WIDTH}
                            height={WALLPAPER_PREVIEW_HEIGHT}
                            className="h-44 w-full max-w-xl touch-none rounded-2xl border border-white/15 bg-black/40 shadow-inner cursor-grab active:cursor-grabbing"
                            onPointerDown={handleWallpaperPointerDown}
                            onPointerMove={handleWallpaperPointerMove}
                            onPointerUp={handleWallpaperPointerUp}
                            onPointerLeave={handleWallpaperPointerUp}
                          />
                          <p className="text-xs text-white/40">Drag to reframe · zoom for finer details</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={4}
                            step={0.01}
                            value={wallpaperCrop.zoom}
                            onChange={(event) =>
                              applyWallpaperCrop((prev) => ({
                                ...prev,
                                zoom: Number(event.target.value),
                              }))
                            }
                            className="flex-1 accent-violet-400"
                          />
                          <button
                            type="button"
                            onClick={resetWallpaperCrop}
                            className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handleWallpaperCancelEdit}
                            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleWallpaperUpload}
                            disabled={wallpaperUploading}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#080814] transition hover:bg-white/80 disabled:opacity-60"
                          >
                            {wallpaperUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Save wallpaper
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                          {wallpaperUrl ? (
                            <NextImage
                              src={wallpaperUrl}
                              alt="Wallpaper preview"
                              fill
                              className="object-cover"
                              sizes="640px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/40">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-white/60">
                          <span>Use a wide image so it feels immersive. We apply a gentle vignette automatically.</span>
                          {wallpaperUrl ? (
                            <button
                              type="button"
                              onClick={handleWallpaperRemove}
                              disabled={wallpaperUploading}
                              className="self-start rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {wallpaperUploading ? "Removing…" : "Remove wallpaper"}
                            </button>
                          ) : (
                            <span className="text-white/40">No wallpaper yet.</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {currentTab === "members" && (
            <section className="flex h-full min-h-[320px] flex-col gap-4">
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={membersSearchValue}
                    onChange={(event) => setMembersSearchValue(event.target.value)}
                    placeholder="Search members by name or email…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                  <span>
                    Active now: {state.activeMembers.toLocaleString("en-US")} members
                  </span>
                  <span>Showing {members.length} loaded</span>
                </div>
              </div>
              <div
                ref={membersParentRef}
                className="relative flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/5"
              >
                {membersLoading && members.length === 0 ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading members…
                  </div>
                ) : members.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
                    No active members match that search.
                  </div>
                ) : (
                  <div
                    style={{
                      height: membersVirtualizer.getTotalSize(),
                      position: "relative",
                    }}
                  >
                    {memberVirtualItems.map((virtualRow) => {
                      const index = virtualRow.index;
                      const member = members[index];
                      const isLoader = index >= members.length;
                      return (
                        <div
                          key={virtualRow.key}
                          className="absolute left-0 right-0 px-3"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                            height: `${virtualRow.size}px`,
                          }}
                        >
                          {isLoader ? (
                            <div className="flex h-full items-center justify-center gap-2 text-sm text-white/60">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading more…
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-between rounded-xl border border-white/10 bg-[#0c0c1c]/80 px-4 py-3 backdrop-blur">
                              <div className="flex items-center gap-3">
                                <MemberAvatar
                                  name={member.displayName}
                                  email={member.email}
                                  avatarUrl={member.avatarUrl}
                                />
                                <div>
                                  <p className="font-medium text-white">
                                    {member.displayName ?? "Member"}
                                  </p>
                                  <p className="text-xs text-white/50">{member.email ?? "—"}</p>
                                  {member.joinedAt && (
                                    <p className="mt-1 text-xs text-white/40">
                                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member)}
                                disabled={memberActionId === member.userId}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {memberActionId === member.userId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserMinus className="h-3.5 w-3.5" />
                                )}
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {currentTab === "removed" && (
            <section className="flex h-full min-h-[320px] flex-col gap-4">
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={removedSearchValue}
                    onChange={(event) => setRemovedSearchValue(event.target.value)}
                    placeholder="Search removed members…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  />
                </div>
                <p className="mt-2 text-xs text-white/40">Restored members can join again.</p>
              </div>
              <div
                ref={removedParentRef}
                className="relative flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/5"
              >
                {removedLoading && removed.length === 0 ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading removed members…
                  </div>
                ) : removed.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
                    This list is clear for now.
                  </div>
                ) : (
                  <div
                    style={{
                      height: removedVirtualizer.getTotalSize(),
                      position: "relative",
                    }}
                  >
                    {removedVirtualItems.map((virtualRow) => {
                      const index = virtualRow.index;
                      const entry = removed[index];
                      const isLoader = index >= removed.length;
                      return (
                        <div
                          key={virtualRow.key}
                          className="absolute left-0 right-0 px-3"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                            height: `${virtualRow.size}px`,
                          }}
                        >
                          {isLoader ? (
                            <div className="flex h-full items-center justify-center gap-2 text-sm text-white/60">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading more…
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-between rounded-xl border border-white/10 bg-[#0c0c1c]/80 px-4 py-3 backdrop-blur">
                              <div className="flex items-center gap-3">
                                <MemberAvatar
                                  name={entry.displayName}
                                  email={entry.email}
                                  avatarUrl={entry.avatarUrl}
                                />
                                <div>
                                  <p className="font-medium text-white">
                                    {entry.displayName ?? "Member"}
                                  </p>
                                  <p className="text-xs text-white/50">{entry.email ?? "—"}</p>
                                  {entry.removedAt && (
                                    <p className="mt-1 text-xs text-white/40">
                                      Removed {new Date(entry.removedAt).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRestoreMember(entry.userId)}
                                disabled={removedActionId === entry.userId}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {removedActionId === entry.userId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3.5 w-3.5" />
                                )}
                                Restore
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {currentTab === "admins" && (
            <section className="flex h-full flex-col gap-5">
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={adminSearchValue}
                    onChange={(event) => setAdminSearchValue(event.target.value)}
                    placeholder="Search subscribers to promote…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  />
                </div>
                <p className="mt-2 text-xs text-white/40">
                  Grant admin access to trusted members. Don’t remove yourself if you’d be the last admin.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.3em] text-white/40">Current admins</h3>
                    <div className="mt-3 space-y-3">
                      {adminsLoading && admins.length === 0 && (
                        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/70">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading admins…
                        </div>
                      )}
                      {admins.length === 0 && !adminsLoading && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                          No admins yet. Promote a trusted member below.
                        </div>
                      )}
                      {admins.map((admin) => {
                        const busy = adminActionId === admin.userId;
                        const disableSelf = admin.userId === viewerId && lastAdminId === viewerId;
                        return (
                          <div
                            key={admin.userId}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <MemberAvatar
                                name={admin.displayName}
                                email={admin.email}
                                avatarUrl={admin.avatarUrl}
                              />
                              <div>
                                <p className="flex items-center gap-2 font-medium text-white">
                                  {admin.displayName ?? "Member"}
                                  {admin.userId === viewerId && (
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                                      You
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-white/50">{admin.email ?? "—"}</p>
                                {admin.addedAt && (
                                  <p className="mt-1 text-xs text-white/40">
                                    Admin since {new Date(admin.addedAt).toLocaleDateString()}
                                  </p>
                                )}
                                {disableSelf && (
                                  <p className="mt-1 text-xs text-rose-300">
                                    Add another admin before removing yourself.
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAdmin(admin)}
                              disabled={disableSelf || busy}
                              className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserMinus className="h-3.5 w-3.5" />
                              )}
                              Remove admin
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.3em] text-white/40">Invite admins</h3>
                    <div className="mt-3 space-y-3">
                      {adminMatchesLoading && (
                        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/70">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching members…
                        </div>
                      )}
                      {!adminMatchesLoading && adminQuery && adminMatches.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                          No subscribers found with that search.
                        </div>
                      )}
                      {!adminQuery && (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50">
                          Start typing to search active subscribers.
                        </div>
                      )}
                      {adminMatches.map((candidate) => {
                        const busy = adminActionId === candidate.userId;
                        const isAdmin = candidate.isAdmin;
                        const disableSelf =
                          isAdmin && candidate.userId === viewerId && lastAdminId === viewerId;
                        return (
                          <div
                            key={candidate.userId}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <MemberAvatar
                                name={candidate.displayName}
                                email={candidate.email}
                                avatarUrl={candidate.avatarUrl}
                              />
                              <div>
                                <p className="font-medium text-white">
                                  {candidate.displayName ?? "Member"}
                                </p>
                                <p className="text-xs text-white/50">{candidate.email ?? "—"}</p>
                                {candidate.addedAt ? (
                                  <p className="mt-1 text-xs text-white/40">
                                    Admin since {new Date(candidate.addedAt).toLocaleDateString()}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-white/40">Active subscriber</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                isAdmin ? handleRemoveAdmin(candidate) : handleGrantAdmin(candidate.userId)
                              }
                              disabled={disableSelf || busy}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                isAdmin
                                  ? "bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                              }`}
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isAdmin ? (
                                <UserMinus className="h-3.5 w-3.5" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" />
                              )}
                              {isAdmin ? "Remove admin" : "Grant admin"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {currentTab === "recent" && (
            <section className="flex h-full min-h-[320px] flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {AUDIT_FILTERS.map((filter) => {
                  const selected = auditFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setAuditFilter(filter.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selected
                          ? "border-white bg-white text-[#080814]"
                          : "border-white/15 bg-white/10 text-white/70 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
              <div
                ref={auditParentRef}
                className="relative flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/5"
              >
                {auditLoading && auditEntries.length === 0 ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading actions…
                  </div>
                ) : auditEntries.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
                    No activity yet.
                  </div>
                ) : (
                  <div
                    style={{
                      height: auditVirtualizer.getTotalSize(),
                      position: "relative",
                    }}
                  >
                    {auditVirtualItems.map((virtualRow) => {
                      const index = virtualRow.index;
                      const entry = auditEntries[index];
                      const isLoader = index >= auditEntries.length;
                      return (
                        <div
                          key={virtualRow.key}
                          className="absolute left-0 right-0 px-3"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                            height: `${virtualRow.size}px`,
                          }}
                        >
                          {isLoader ? (
                            <div className="flex h-full items-center justify-center gap-2 text-sm text-white/60">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading more…
                            </div>
                          ) : (
                            <article className="flex h-full flex-col justify-center gap-3 rounded-xl border border-white/10 bg-[#0c0c1c]/80 px-4 py-3 text-sm text-white/80 backdrop-blur">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs uppercase text-white/40">
                                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/60">
                                    {AUDIT_FILTER_LABEL[categorizeAction(entry.action)]}
                                  </span>
                                </div>
                                <span className="whitespace-nowrap text-xs uppercase text-white/40">
                                  {formatRelativeTime(entry.at)}
                                </span>
                              </div>
                              <p className="font-medium text-white">{summarizeAuditEntry(entry)}</p>
                              {entry.fromText && entry.fromText !== entry.toText && (
                                <div className="space-y-1 text-xs text-white/50">
                                  <p className="truncate text-white/40">Previous: {truncateText(entry.fromText)}</p>
                                  {entry.toText && (
                                    <p className="truncate text-white/50">New: {truncateText(entry.toText)}</p>
                                  )}
                                </div>
                              )}
                              {!entry.fromText && entry.toText && (
                                <p className="truncate text-xs text-white/50">Value: {truncateText(entry.toText)}</p>
                              )}
                            </article>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-white/10 bg-[#080814]/95 px-6 py-4 backdrop-blur">
          {(currentTab === "general" || currentTab === "appearance") && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!(canSaveGeneral || canSaveAppearance)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#080814] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(saving || avatarUploading || wallpaperUploading) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save changes
              </button>
            </div>
          )}
          {currentTab !== "general" && currentTab !== "appearance" && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={refreshCurrentTab}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          )}
        </footer>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
        />
        <input
          ref={wallpaperInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleWallpaperFile}
        />
      </div>
      {confirmDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111120] p-6 text-white shadow-2xl">
            <h2 className="text-lg font-semibold">{`Remove ${confirmDialog.name}?`}</h2>
            <p className="mt-2 text-sm text-white/70">{confirmDialog.body}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={confirmBusy}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={confirmBusy}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#080814] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirmBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {confirmDialog.type === "member" ? "Remove member" : "Remove admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
