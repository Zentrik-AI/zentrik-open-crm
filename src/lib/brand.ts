/**
 * The product's name, in one place. Everything user-facing reads it from here,
 * so a rename is a one-line change plus the repository and package names.
 */
export const brand = {
  /** Short name used in the app chrome and commands. */
  name: "Open CRM",
  /** Full name with the maker, for titles and documents. */
  fullName: "Zentrik Open CRM",
  /** One line under the name: what it is, for whom. */
  descriptor: "Relationship management for people and their agents",
  maker: "Zentrik",
  makerUrl: "https://zentrik.ai",
  /** Where to send people who want their account evidence to become product decisions. */
  productWorkUrl: "https://zentrik.ai",
  repoUrl: "https://github.com/Zentrik-AI/zentrik-open-crm",
} as const;
