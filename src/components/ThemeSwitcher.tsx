import { useTheme } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Tema</span>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className={
          "rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text outline-none " +
          "focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary/40"
        }
      >
        {themes.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
