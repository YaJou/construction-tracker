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
        orange: {
          DEFAULT: "#FF7A1A",
        },
        green: {
          DEFAULT: "#173F34",
        },
        cream: {
          DEFAULT: "#FFF1E5",
        },
        page: {
          DEFAULT: "#FBFCFB",
        },
        line: {
          DEFAULT: "#E6EBE8",
        },
        muted: {
          DEFAULT: "#6F7B76",
        },
        surface: {
          DEFAULT: "#F7F9F8",
          muted: "#F5F5F5",
          dark: "#173F34",
        },
        border: "#E6EBE8",
        ink: {
          DEFAULT: "#17201D",
          muted: "#6F7B76",
          subtle: "#9AA6A1",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
      },
      boxShadow: {
        soft: "0 12px 32px rgba(23, 63, 52, 0.08)",
      },
      borderRadius: {
        card: "18px",
        field: "12px",
        btn: "10px",
        cta: "24px",
      },
      fontSize: {
        body: ["17px", { lineHeight: "27px" }],
        caption: ["14px", { lineHeight: "20px" }],
        h1: ["56px", { lineHeight: "60px", fontWeight: "700" }],
        "h1-mobile": ["36px", { lineHeight: "40px", fontWeight: "700" }],
        h2: ["36px", { lineHeight: "42px", fontWeight: "700" }],
      },
      transitionDuration: {
        fast: "180ms",
        soft: "220ms",
      },
    },
  },
  plugins: [],
};

export default config;
