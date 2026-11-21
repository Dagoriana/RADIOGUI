export type StationCategory =
  | 'todas'
  | 'favoritas'
  | 'noticias'
  | 'rock'
  | 'musica'
  | 'provincias'
  | 'bajo-consumo';

export interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  city: string;
  province: string;
  genre: string;
  category: Exclude<StationCategory, 'todas' | 'favoritas' | 'bajo-consumo'>;
  streamUrl: string;
  lowDataUrl?: string;
  fallbackUrl?: string;
  bitrate: number; // kbps
  codec: 'AAC+' | 'AAC' | 'MP3' | 'OGG';
  isCustom?: boolean;
  isFromDirectory?: boolean;
}

export type PlaybackStatus = 'stopped' | 'connecting' | 'playing' | 'paused' | 'error';

export type DataSaverMode = 'auto-wifi' | 'always' | 'off';

export type SleepTimerMinutes = 0 | 15 | 30 | 60;
