import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#003366",
          light: "#0055AA"
        },
        accent: {
          DEFAULT: "#E8A020",
          gold: "#C8891A"
        }
      },
      borderRadius: {
        xl2: "10px"
      }
    }
  },
  plugins: []
};

export default config;
