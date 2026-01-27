import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [typography],
};

export default config;
