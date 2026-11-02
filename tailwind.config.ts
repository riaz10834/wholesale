import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdbff",
          300: "#8ec4ff",
          400: "#59a2ff",
          500: "#337dff",
          600: "#1b5cf5",
          700: "#1447e1",
          800: "#173ab6",
          900: "#19368f",
          950: "#142257",
        },
        ink: {
          900: "#0b1220",
          800: "#111a2e",
          700: "#1c2640",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.06)",
        lift: "0 10px 30px -10px rgba(27,92,245,.35)",
      },
    },
  },
  plugins: [],
};

export default config;
