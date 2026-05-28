import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: "#000000",
          800: "#0a0a0a",
          700: "#111111",
          600: "#1a1a1a",
          500: "#222222",
          400: "#333333",
        },
      },
    },
  },
  plugins: [],
};

export default config;
