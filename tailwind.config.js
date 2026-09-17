/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";

export default {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        ultra: {
          red: "#E30613",     // rojo vivo ULTRA
          gray: "#9A9A9A",    // gris
          dark: "#1A1A1A",    // negro
          light: "#FFFFFF",   // blanco
        },
      },
      fontFamily: {
        black: ['"Arial Black"', "Arial", "sans-serif"],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        ultralight: {
          primary: "#E30613",
          "primary-content": "#FFFFFF",
          secondary: "#9A9A9A",
          accent: "#1A1A1A",
          neutral: "#1A1A1A",
          "base-100": "#FFFFFF",
          "base-200": "#F3F3F3",
          "base-300": "#E4E4E4",
          "base-content": "#1A1A1A",
          info: "#3ABFF8",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#E30613",
        },
      },
      {
        ultradark: {
          primary: "#E30613",
          "primary-content": "#FFFFFF",
          secondary: "#9A9A9A",
          accent: "#FFFFFF",
          neutral: "#0F0F0F",
          "base-100": "#1A1A1A",
          "base-200": "#141414",
          "base-300": "#0F0F0F",
          "base-content": "#F3F3F3",
          info: "#3ABFF8",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#E30613",
        },
      },
    ],
    darkTheme: "ultradark",
  },
};
