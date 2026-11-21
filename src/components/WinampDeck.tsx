import React from 'react';
import {
  AlertCircle,
  Clock,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Star,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import {DataSaverMode, PlaybackStatus, RadioStation, SleepTimerMinutes} from '../types/radio';
import {formatBytes} from '../utils/cacheManager';
import {SpectrumVisualizer} from './SpectrumVisualizer';

interface WinampDeckProps {
  station: RadioStation | null;
  status: PlaybackStatus;
  errorMessage: string | null;
  bufferSeconds: number;
  reconnectAttempt: number;
  volume: number;
  isMuted: boolean;
  elapsedSeconds: number;
  sessionBytes: number;
  sleepMinutes: SleepTimerMinutes;
  sleepRemainingSec: number;
  isFavorite: boolean;
  dataSaverMode: DataSaverMode;
  isDataSaverActive: boolean;
  isOnWifi: boolean | null;
  isSlowConnection: boolean;
  onTogglePlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleFavorite: (id: string) => void;
  onSleepChange: (mins: SleepTimerMinutes) => void;
  onDataSaverModeChange: (mode: DataSaverMode) => void;
}

function formatDuration(totalSec: number): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export const WinampDeck: React.FC<WinampDeckProps> = ({
  station,
  status,
  errorMessage,
  bufferSeconds,
  reconnectAttempt,
  volume,
  isMuted,
  elapsedSeconds,
  sessionBytes,
  sleepMinutes,
  sleepRemainingSec,
  isFavorite,
  dataSaverMode,
  isDataSaverActive,
  isOnWifi,
  isSlowConnection,
  onTogglePlayPause,
  onStop,
  onPrev,
  onNext,
  onVolumeChange,
  onToggleMute,
  onToggleFavorite,
  onSleepChange,
  onDataSaverModeChange,
}) => {
  const isPlaying = status === 'playing';
  const isConnecting = status === 'connecting';

  const statusLabel =
    reconnectAttempt > 0 && isConnecting
      ? `RECONECTANDO ${reconnectAttempt}/5`
      : status === 'playing'
        ? 'EN VIVO'
        : status === 'connecting'
          ? 'ALMACENANDO BÚFER'
          : status === 'paused'
            ? 'PAUSA'
            : status === 'error'
              ? 'SIN SEÑAL'
              : 'LISTO';

  const effectiveBitrate = station
    ? isDataSaverActive && station.lowDataUrl
      ? Math.min(station.bitrate, 64)
      : station.bitrate
    : 0;
  const effectiveCodec =
    station && isDataSaverActive && station.lowDataUrl ? 'AAC+' : (station?.codec ?? '--');
  const mbPerHour = effectiveBitrate > 0 ? ((effectiveBitrate * 3600) / (8 * 1024)).toFixed(0) : '0';

  return (
    <section
      aria-label="Reproductor"
      className="winamp-chassis rounded-2xl border border-zinc-300 bg-zinc-200/80 p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-[#171a21] min-w-0"
    >
      {/* Recessed Winamp LCD Display */}
      <div className="winamp-lcd rounded-xl border border-zinc-800 p-3 text-zinc-100 min-w-0">
        <div className="flex items-center justify-between gap-2.5 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-lcd">
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  isPlaying
                    ? 'text-emerald-400'
                    : isConnecting
                      ? 'text-amber-400'
                      : status === 'error'
                        ? 'text-rose-400'
                        : 'text-zinc-400'
                }`}
              >
                {isPlaying && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                )}
                {statusLabel}
              </span>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span className="text-sky-400">{formatDuration(elapsedSeconds)}</span>
              {sleepRemainingSec > 0 && (
                <>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="text-amber-300">{formatDuration(sleepRemainingSec)}</span>
                </>
              )}
            </div>

            <h2 className="mt-1 font-display text-base sm:text-lg font-semibold text-white truncate">
              {station ? station.name : 'Elegí una emisora'}
            </h2>

            <p className="mt-0.5 text-xs text-zinc-400 truncate">
              {station ? `${station.frequency} · ${station.city}` : 'Argentina en vivo'}
            </p>
          </div>

          <div className="hidden xs:block sm:block shrink-0">
            <SpectrumVisualizer
              status={status}
              disabled={isDataSaverActive}
              bitrate={effectiveBitrate || 64}
            />
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-lcd text-zinc-400">
          <span className="truncate">
            <span className="text-sky-400">{station ? `${effectiveBitrate}k` : '--'}</span>
            {' '}
            {effectiveCodec}
            {station ? ` (~${mbPerHour} MB/h)` : ''}
          </span>
          <span className="shrink-0 flex items-center gap-2">
            {(isPlaying || isConnecting) && bufferSeconds > 0 && (
              <span className="text-emerald-400">BUF {bufferSeconds.toFixed(1)}s</span>
            )}
            <span>
              Datos: <span className="text-amber-300">{formatBytes(sessionBytes)}</span>
            </span>
          </span>
        </div>
      </div>

      {/* Inline Stream Recovery / Error */}
      {errorMessage && (
        <div
          role="status"
          className={`mt-2.5 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            status === 'connecting'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Compact Single-Row Transport Controls */}
      <div className="mt-3 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Emisora anterior"
            className="winamp-btn flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={isPlaying || isConnecting ? 'Pausar' : 'Reproducir'}
            className="winamp-btn flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-sky-500 text-slate-950 font-semibold text-sm hover:bg-sky-400 whitespace-nowrap shrink-0"
          >
            {isPlaying || isConnecting ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Escuchar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStop}
            aria-label="Detener"
            className="winamp-btn flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Emisora siguiente"
            className="winamp-btn flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {station && (
          <button
            type="button"
            onClick={() => onToggleFavorite(station.id)}
            aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            className={`winamp-btn flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border shrink-0 ${
              isFavorite
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-500'
                : 'border-zinc-300 bg-white text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Minimal Volume + Sleep Timer */}
      <div className="mt-3 pt-2.5 border-t border-zinc-300/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
            className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg text-zinc-700 dark:text-zinc-300"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Volumen"
            className="winamp-slider flex-1 min-w-[60px]"
          />

          <span className="font-lcd text-xs text-zinc-600 dark:text-zinc-400 w-9 text-right shrink-0">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5 text-zinc-400 mr-0.5" aria-hidden="true" />
          {([0, 15, 30, 60] as SleepTimerMinutes[]).map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onSleepChange(mins)}
              className={`px-2 py-1 text-[11px] font-lcd rounded-md transition-colors min-h-[34px] ${
                sleepMinutes === mins
                  ? 'bg-zinc-900 text-white dark:bg-zinc-700'
                  : 'text-zinc-600 hover:bg-zinc-300/60 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {mins === 0 ? 'Off' : `${mins}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Minimalist Data Saver Mode (Always / Auto off on WiFi / Off) */}
      <div className="mt-2.5 pt-2.5 border-t border-zinc-300/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 min-w-0">
          <Wifi
            className={`w-3.5 h-3.5 shrink-0 ${
              isDataSaverActive ? 'text-sky-500' : 'text-emerald-500'
            }`}
            aria-hidden="true"
          />
          <span className="font-medium truncate">
            Ahorro datos
            {dataSaverMode === 'auto-wifi' && isSlowConnection
              ? ' (Red lenta)'
              : dataSaverMode === 'auto-wifi' && isOnWifi === true
                ? ' (WiFi)'
                : ''}
          </span>
        </div>

        <div
          role="group"
          aria-label="Modo ahorro de datos móviles"
          className="inline-flex items-center rounded-lg bg-zinc-300/70 p-0.5 dark:bg-zinc-800/90 shrink-0"
        >
          {(
            [
              {id: 'auto-wifi', label: 'Sin WiFi'},
              {id: 'always', label: 'Siempre'},
              {id: 'off', label: 'Off'},
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onDataSaverModeChange(opt.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap min-h-[34px] ${
                dataSaverMode === opt.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
