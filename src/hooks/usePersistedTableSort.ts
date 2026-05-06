import { useCallback, useEffect, useRef, useState } from "react";

export type SortDir = "asc" | "desc";

type Stored<K extends string> = { key: K; dir: SortDir };

function storageSuffix(storageKey: string) {
  return `${storageKey}_sort`;
}

function loadStored<K extends string>(
  storageKey: string | undefined,
  validKeys: readonly K[] | undefined,
  fallbackKey: K,
  fallbackDir: SortDir,
): Stored<K> {
  if (!storageKey || typeof window === "undefined") {
    return { key: fallbackKey, dir: fallbackDir };
  }
  try {
    const raw = window.localStorage.getItem(storageSuffix(storageKey));
    if (!raw) return { key: fallbackKey, dir: fallbackDir };
    const parsed = JSON.parse(raw) as Partial<Stored<string>>;
    const dir: SortDir = parsed.dir === "desc" ? "desc" : "asc";
    const key = typeof parsed.key === "string" ? (parsed.key as K) : fallbackKey;
    if (validKeys && !validKeys.includes(key)) {
      return { key: fallbackKey, dir: fallbackDir };
    }
    return { key, dir };
  } catch {
    return { key: fallbackKey, dir: fallbackDir };
  }
}

function saveStored(storageKey: string | undefined, value: Stored<string>) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageSuffix(storageKey), JSON.stringify(value));
  } catch {
    /* quota / privacy mode — ignorar */
  }
}

export type UsePersistedTableSortOptions<K extends string> = {
  storageKey: string | undefined;
  defaultKey: K;
  defaultDir?: SortDir;
  validKeys?: readonly K[];
  onChange?: () => void;
};

export function usePersistedTableSort<K extends string = string>(
  options: UsePersistedTableSortOptions<K>,
) {
  const { storageKey, defaultKey, defaultDir = "asc", validKeys, onChange } = options;

  const [state, setState] = useState<Stored<K>>(() =>
    loadStored<K>(storageKey, validKeys, defaultKey, defaultDir),
  );

  const storageKeyRef = useRef(storageKey);
  useEffect(() => {
    if (storageKeyRef.current === storageKey) return;
    storageKeyRef.current = storageKey;
    setState(loadStored<K>(storageKey, validKeys, defaultKey, defaultDir));
  }, [storageKey, validKeys, defaultKey, defaultDir]);

  const persist = useCallback(
    (next: Stored<K>) => {
      setState(next);
      saveStored(storageKey, next);
      onChange?.();
    },
    [storageKey, onChange],
  );

  const toggleSort = useCallback(
    (key: K) => {
      setState((prev) => {
        const next: Stored<K> =
          prev.key === key
            ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
            : { key, dir: "asc" };
        saveStored(storageKey, next);
        return next;
      });
      onChange?.();
    },
    [storageKey, onChange],
  );

  const setSortKey = useCallback(
    (key: K) => persist({ key, dir: state.dir }),
    [persist, state.dir],
  );

  const setSortDir = useCallback(
    (dir: SortDir) => persist({ key: state.key, dir }),
    [persist, state.key],
  );

  return {
    sortKey: state.key,
    sortDir: state.dir,
    toggleSort,
    setSortKey,
    setSortDir,
  };
}
