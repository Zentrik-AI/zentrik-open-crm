import {
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
  | "pipeline"
  | "accounts"
  | "contacts"
  | "tasks"
  | "notes"
  | "settings"
  | "improve";

export type NavEntry = { id: View; label: string; icon: LucideIcon };

/** The CRM itself — the primary product. */
export const primaryNav: NavEntry[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "pipeline", label: "Pipeline", icon: Columns3 },
  { id: "accounts", label: "Accounts", icon: Building2 },
  { id: "contacts", label: "Contacts", icon: Contact },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "notes", label: "Notes", icon: StickyNote },
];

/** Workspace + the product-feedback corner — deliberately de-emphasized. */
export const secondaryNav: NavEntry[] = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "improve", label: "Improve Open CRM", icon: Lightbulb },
];

export const allNav: NavEntry[] = [...primaryNav, ...secondaryNav];
