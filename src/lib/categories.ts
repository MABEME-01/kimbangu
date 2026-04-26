import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Category = { value: string; label: string };
export type CategoryValue = string;

// In-memory cache so multiple components share one fetch
let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;
const listeners = new Set<(cats: Category[]) => void>();

export async function fetchCategories(force = false): Promise<Category[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("categories")
      .select("value,label")
      .order("label", { ascending: true });
    const next = (data ?? []) as Category[];
    cache = next;
    listeners.forEach((cb) => cb(next));
    inflight = null;
    return next;
  })();
  return inflight;
}

export function useCategories() {
  const [cats, setCats] = useState<Category[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    let active = true;
    fetchCategories().then((c) => {
      if (active) {
        setCats(c);
        setLoading(false);
      }
    });
    const cb = (c: Category[]) => active && setCats(c);
    listeners.add(cb);
    return () => {
      active = false;
      listeners.delete(cb);
    };
  }, []);
  return { categories: cats, loading, refresh: () => fetchCategories(true) };
}

export function categoryLabel(value: string): string {
  return cache?.find((c) => c.value === value)?.label ?? value;
}

export function preloadCategories() {
  fetchCategories();
}
