import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(
  bucket: "pdfs" | "audios" | "images",
  path: string,
  expiresInSec = 3600
): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error || !data) return null;
  cache.set(key, { url: data.signedUrl, expires: Date.now() + expiresInSec * 1000 });
  return data.signedUrl;
}

export async function getSignedUrls(
  bucket: "pdfs" | "audios" | "images",
  paths: string[],
  expiresInSec = 3600
): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresInSec);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}

/** Storage path helpers */
export function bucketForKind(kind: "pdf" | "audio" | "image"): "pdfs" | "audios" | "images" {
  return kind === "pdf" ? "pdfs" : kind === "audio" ? "audios" : "images";
}

export async function deleteStorageObject(
  bucket: "pdfs" | "audios" | "images",
  path: string
): Promise<void> {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
  cache.delete(`${bucket}/${path}`);
}
