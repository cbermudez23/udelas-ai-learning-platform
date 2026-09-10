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
          DEFAULT: "#002F5C",
          light: "#0055AA"
        },
        accent: {
          DEFAULT: "#E8A020",
          gold: "#C8891A"
        },
        role: {
          student: "#1A73E8",
          studentBg: "#EAF1FD",
          teacher: "#0B8043",
          teacherBg: "#E6F4EC",
          admin: "#B06000",
          adminBg: "#FBF0E0"
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
