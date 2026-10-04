import {
  BookOpen,
  ScanLine,
  Mic,
  Bot,
  Building2,
  Columns3,
  Contact,
  Home,
  Lightbulb,
  ListChecks,
  Settings,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export type View =
  | "home"
  | "book"
  | "pipeline"
  | "accounts"
  | "contacts"
  | "tasks"
  | "calls"
  | "updates"
  | "notes"
  | "review"
  | "settings"
  | "improve";

export type NavEntry = { id: View; label: string; icon: LucideIcon };

/** The CRM itself — the primary product. */
export const primaryNav: NavEntry[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "book", label: "Book", icon: BookOpen },
  { id: "pipeline", label: "Pipeline", icon: Columns3 },
  { id: "accounts", label: "Accounts", icon: Building2 },
  { id: "contacts", label: "Contacts", icon: Contact },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "calls", label: "Calls", icon: Mic },
  { id: "updates", label: "Update accounts", icon: ScanLine },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "review", label: "Review", icon: Bot },
];

/** Workspace + the product-feedback corner — deliberately de-emphasized. */
export const secondaryNav: NavEntry[] = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "improve", label: "Improve", icon: Lightbulb },
];

export const allNav: NavEntry[] = [...primaryNav, ...secondaryNav];

/** Sidebar sections: the day, the accounts, and what comes in to be checked. */
export const navGroups: { label?: string; items: View[] }[] = [
  { items: ["home"] },
  { label: "Accounts", items: ["accounts", "pipeline", "book", "contacts", "tasks"] },
  { label: "Capture", items: ["updates", "calls", "notes", "review"] },
];
