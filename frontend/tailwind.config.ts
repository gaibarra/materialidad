import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f3f5f7",
          100: "#e1e5ea",
          200: "#c5ccd5",
          500: "#1f2933",
          700: "#111827",
        },
        jade: {
          500: "#1eb980",
          600: "#159c69",
        },
        flame: {
          500: "#f95f53",
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
