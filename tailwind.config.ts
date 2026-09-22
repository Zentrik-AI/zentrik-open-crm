import type { Config } from "tailwindcss";

/** hsl(var(--token) / <alpha-value>) so every color supports opacity modifiers. */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        "faint-foreground": token("faint-foreground"),
        surface: token("surface"),
        "surface-raised": token("surface-raised"),
        "surface-sunken": token("surface-sunken"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        border: { DEFAULT: token("border"), strong: token("border-strong") },
        input: token("input"),
        ring: token("ring"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        accent: { DEFAULT: token("accent"), bg: token("accent-bg"), fg: token("accent-fg") },
        signal: { DEFAULT: token("signal"), bg: token("signal-bg"), fg: token("signal-fg") },
        account: { DEFAULT: token("account"), bg: token("account-bg"), fg: token("account-fg") },
        agent: { DEFAULT: token("agent"), bg: token("agent-bg"), fg: token("agent-fg") },
        idea: { DEFAULT: token("idea"), bg: token("idea-bg"), fg: token("idea-fg") },
        success: {
          DEFAULT: token("success"),
          bg: token("success-bg"),
          fg: token("success-fg"),
          foreground: token("success-foreground"),
        },
        warning: {
          DEFAULT: token("warning"),
          bg: token("warning-bg"),
          fg: token("warning-fg"),
          foreground: token("warning-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          bg: token("destructive-bg"),
          fg: token("destructive-fg"),
          foreground: token("destructive-foreground"),
        },
      },
      fontFamily: {
        serif: "var(--font-serif)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        display: ["var(--text-display)", { lineHeight: "1.16", letterSpacing: "-0.025em", fontWeight: "500" }],
        h1: ["var(--text-h1)", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "500" }],
        h2: ["var(--text-h2)", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "500" }],
        h3: ["0.9375rem", { lineHeight: "1.3", letterSpacing: "-0.005em", fontWeight: "500" }],
        body: ["var(--text-body)", { lineHeight: "1.55" }],
        "body-sm": ["var(--text-body-sm)", { lineHeight: "1.5" }],
        label: ["var(--text-label)", { lineHeight: "1.4", letterSpacing: "0.025em", fontWeight: "500" }],
        "stat-xl": ["1.625rem", { lineHeight: "1.12", fontWeight: "500" }],
        stat: ["0.9375rem", { lineHeight: "1.3", fontWeight: "500" }],
        kbd: ["0.6875rem", { lineHeight: "1", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        e1: "var(--e-1)",
        e2: "var(--e-2)",
        e3: "var(--e-3)",
        focus: "var(--focus-ring)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
        trace: "500ms",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
