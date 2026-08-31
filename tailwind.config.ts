import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#082f57",
          dark: "#061f3b",
          light: "#0d437a",
        },
        brand: {
          blue: "#0b63b6",
          blue2: "#1781df",
          50: "#eff7ff",
          100: "#d7eaff",
        },
        status: {
          green: "#087a5b",
          green50: "#e4f7f0",
          red: "#b42318",
          red50: "#fee4e2",
          orange: "#b54708",
          orange50: "#ffead5",
        }
      },
    },
  },
  plugins: [],
};
export default config;
