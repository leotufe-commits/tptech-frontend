/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Core */
        bg: "var(--bg)",
        card: "var(--card)",
        text: "var(--text)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",

        /* Contrast helpers (CLAVE para dark theme) */
        muted: "var(--muted)",        // texto secundario, labels, breadcrumbs
        border: "var(--border)",      // bordes visibles en dark
        surface: "var(--surface)",    // inputs, filtros, bloques suaves
        surface2: "var(--surface2)",  // headers de tabla, hover sutil
      },
    },
  },
  plugins: [],
};
