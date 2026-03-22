import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        slate: {
          50: "#f8fafc",
          100: "#edf2f7",
          200: "#e2e8f0",
          300: "#cbd5e0",
          400: "#a0aec0",
          500: "#718096",
          600: "#4a5568", // accent
          700: "#2d3748", // text dark
          800: "#1a2332", // primary deep navy
          900: "#111827",
        },
        ink: {
          50: "#f5f7fa",
          100: "#e8edf3",
          200: "#cfd7e3",
          300: "#aab7c8",
          400: "#6f859e",
          500: "#2d3748", // body text
          600: "#243045",
          700: "#1a2332", // primary deep navy
          800: "#131a25",
          900: "#0e131c",
        },
        jade: {
          50: "#fff3eb",
          100: "#ffe1d2",
          200: "#ffc4a8",
          300: "#ff9f70",
          400: "#ff7f48",
          500: "#ff6b35", // secondary / CTA
          600: "#e85f30",
          700: "#c54d28",
          800: "#9f3d20",
          900: "#7f311a",
        },
        flame: {
          50: "#f2f4f7",
          100: "#e3e7ee",
          200: "#c8cedd",
          300: "#a3abbf",
          400: "#7c869f",
          500: "#4a5568", // accent neutral
          600: "#3f495a",
          700: "#343c4b",
          800: "#2a303d",
          900: "#202530",
        },
        background: {
          DEFAULT: "#f8fafc",
        },
        text: {
          light: "#ffffff",
          dark: "#2d3748",
        },
        fiscal: {
          canvas: "#f4f2ed",
          panel: "#fbfaf7",
          shell: "#0f1724",
          shellSoft: "#162233",
          line: "#d8d3c8",
          ink: "#172033",
          muted: "#5b6678",
          accent: "#2d5b88",
          accentSoft: "#dbe6f0",
          gold: "#b88946",
          success: "#1f7a5a",
          successSoft: "#ddf1e8",
          warning: "#a6671f",
          warningSoft: "#f7e7d3",
          danger: "#a0433d",
          dangerSoft: "#f7ddda",
        },
      },
      borderRadius: {
        fiscal: "1.25rem",
        panel: "1.5rem",
      },
      boxShadow: {
        fiscal: "0 18px 45px rgba(15, 23, 36, 0.08)",
        panel: "0 10px 30px rgba(15, 23, 36, 0.06)",
        insetLine: "inset 0 1px 0 rgba(255,255,255,0.8)",
      },
      backgroundImage: {
        parchmentGlow:
          "radial-gradient(circle at 15% 20%, rgba(184, 137, 70, 0.12), transparent 32%), radial-gradient(circle at 85% 0%, rgba(45, 91, 136, 0.14), transparent 30%)",
      },
    },
  },
  plugins: [typography],
};

export default config;
