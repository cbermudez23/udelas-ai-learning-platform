import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px"
    },
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
