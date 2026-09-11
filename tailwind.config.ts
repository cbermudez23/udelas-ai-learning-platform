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
          DEFAULT: "#103781",
          light: "#0055AA"
        },
        accent: {
          DEFAULT: "#00A6CE",
          gold: "#006884"
        },
        role: {
          student: "#1A73E8",
          studentBg: "#EAF1FD",
          teacher: "#0B8043",
          teacherBg: "#E6F4EC",
          admin: "#006884",
          adminBg: "#E3F6FA"
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
