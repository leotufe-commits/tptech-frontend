/** @type {import('tailwindcss').Config} */

const withAlpha = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Core */
        bg: "var(--bg)",
        card: "var(--card)",
        text: "var(--text)",

        /**
         * ✅ IMPORTANTE (FIX focus/ring):
         * Para que clases tipo `ring-primary/20` NO caigan a azul,
         * el color debe soportar alpha. Usamos rgb(var(--*-rgb) / <alpha-value>)
         */
        primary: withAlpha("--primary-rgb"),
        secondary: withAlpha("--secondary-rgb"),

        /* Contrast helpers */
        muted: "var(--muted)",
        border: withAlpha("--border-rgb"),
        surface: "var(--surface)",
        surface2: "var(--surface2)",
      },
    },
  },
  plugins: [],
};
