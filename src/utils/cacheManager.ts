import {RadioStation} from '../types/radio';

const DIRECTORY_CACHE_NAME = 'radiowin-directory-v1';
const DIRECTORY_CACHE_URL = '/_cache/argentine-directory.json';
const RADIO_BROWSER_ENDPOINT =
  'https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/AR?limit=45&order=clickcount&reverse=true&hidebroken=true';
const DEFAULT_TTL_MS = 24 * 3600 * 1000;

interface DirectoryCachePayload {
  cachedAt: number;
  stations: RadioStation[];
}

function classifyGenre(tags: string, name: string): RadioStation['category'] {
  const hay = `${tags} ${name}`.toLowerCase();
  if (/rock|punk|metal|indie|cosquin|vorterix/.test(hay)) return 'rock';
  if (/news|noticias|talk|deport|am\s?\d+|mitre|rivadavia|nacional|patria|periodis/.test(hay)) {
    return 'noticias';
  }
  if (/c[oó]rdoba|rosario|mendoza|salta|chaco|tucum|neuqu|santa fe|mar del plata|bah[ií]a|tandil/.test(hay)) {
    return 'provincias';
  }
  return 'musica';
}

function normalizeCodec(raw: string): RadioStation['codec'] {
  const up = (raw || '').toUpperCase();
  if (up.includes('AAC+')) return 'AAC+';
  if (up.includes('AAC')) return 'AAC';
  if (up.includes('OGG')) return 'OGG';
  return 'MP3';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function computeBytesForDuration(bitrateKbps: number, seconds: number): number {
  const safeKbps = bitrateKbps > 0 ? bitrateKbps : 64;
  return Math.max(0, (safeKbps * 1000 * seconds) / 8);
}

export async function readCachedDirectory(): Promise<DirectoryCachePayload | null> {
  try {
    if ('caches' in window) {
      const cache = await caches.open(DIRECTORY_CACHE_NAME);
      const match = await cache.match(DIRECTORY_CACHE_URL);
      if (match) {
        const json = (await match.json()) as DirectoryCachePayload;
        if (json && Array.isArray(json.stations)) return json;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeCachedDirectory(stations: RadioStation[]): Promise<void> {
  const payload: DirectoryCachePayload = {cachedAt: Date.now(), stations};
  try {
    if ('caches' in window) {
      const cache = await caches.open(DIRECTORY_CACHE_NAME);
      const serialized = JSON.stringify(payload);
      await cache.put(
        DIRECTORY_CACHE_URL,
        new Response(serialized, {headers: {'Content-Type': 'application/json'}}),
      );
    }
  } catch {
    // ignore
  }
}

export async function runAutomaticCacheHygiene(): Promise<void> {
  try {
    // Prune expired directory cache automatically without touching favorites
    const cached = await readCachedDirectory();
    if (cached && Date.now() - cached.cachedAt > 7 * 24 * 3600 * 1000) {
      if ('caches' in window) {
        await caches.delete(DIRECTORY_CACHE_NAME);
      }
    }

    // If storage usage exceeds 80% of quota, free non-essential caches automatically
    if (navigator.storage?.estimate && 'caches' in window) {
      const est = await navigator.storage.estimate();
      if (est.quota && est.usage && est.usage / est.quota > 0.8) {
        await caches.delete(DIRECTORY_CACHE_NAME);
      }
    }
  } catch {
    // ignore silently
  }
}

export async function fetchArgentineDirectory(): Promise<RadioStation[]> {
  const existing = await readCachedDirectory();
  if (existing && Date.now() - existing.cachedAt < DEFAULT_TTL_MS) {
    return existing.stations;
  }

  const res = await fetch(RADIO_BROWSER_ENDPOINT, {headers: {Accept: 'application/json'}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const rawList = (await res.json()) as Array<{
    stationuuid: string;
    name: string;
    url_resolved: string;
    bitrate: number;
    codec: string;
    state: string;
    tags: string;
  }>;

  const seenUrls = new Set<string>();
  const stations: RadioStation[] = [];

  for (const item of rawList) {
    const url = (item.url_resolved || '').trim();
    if (!url.startsWith('https://') || url.includes('.m3u8') || seenUrls.has(url)) continue;
    seenUrls.add(url);
    const cleanName = (item.name || 'Emisora AR').trim().replace(/\s+/g, ' ');
    const state = (item.state || 'Argentina').trim() || 'Argentina';
    const freqMatch = cleanName.match(/(\d{2,4}(?:[.,]\d)?\s?(?:FM|AM))/i);

    stations.push({
      id: `rb-${item.stationuuid}`,
      name: cleanName.slice(0, 50),
      frequency: freqMatch ? freqMatch[1].toUpperCase() : 'En Vivo',
      city: state.slice(0, 24),
      province: state.slice(0, 24),
      genre: (item.tags || 'Radio Argentina').split(',').slice(0, 2).join(' · ') || 'En Vivo',
      category: classifyGenre(item.tags || '', cleanName),
      streamUrl: url,
      bitrate: item.bitrate && item.bitrate > 0 ? item.bitrate : 64,
      codec: normalizeCodec(item.codec),
      isFromDirectory: true,
    });
  }

  await writeCachedDirectory(stations);
  return stations;
}
