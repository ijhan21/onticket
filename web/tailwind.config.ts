import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "var(--color-accent)",
        "on-accent": "var(--color-on-accent)",
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        error: "var(--color-error)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        focus: "var(--color-focus)",
      },
      fontFamily: {
        body: ["var(--font-body)"],
      },
      fontSize: {
        caption: ["var(--font-size-caption)", { lineHeight: "var(--line-height-tight)" }],
        body: ["var(--font-size-body)", { lineHeight: "var(--line-height-body)" }],
        title: ["var(--font-size-title)", { lineHeight: "var(--line-height-tight)" }],
        display: ["var(--font-size-display)", { lineHeight: "var(--line-height-tight)" }],
      },
    },
  },
  plugins: [],
};
export default config;
