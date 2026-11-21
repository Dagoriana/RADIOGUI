import {useCallback, useEffect, useRef, useState} from 'react';
import {PlaybackStatus, RadioStation, SleepTimerMinutes} from '../types/radio';
import {computeBytesForDuration} from '../utils/cacheManager';

const TOTAL_BYTES_STORAGE_KEY = 'radiowin_total_bytes_v1';
const VOLUME_STORAGE_KEY = 'radiowin_volume_v1';
const MAX_RECONNECT_ATTEMPTS = 5;
const STALL_TIMEOUT_MS = 7000;

interface UseRadioPlayerOptions {
  stations: RadioStation[];
  sessionDataCapMB: number | null;
  preferLowData?: boolean;
}

export function useRadioPlayer({
  stations,
  sessionDataCapMB,
  preferLowData = false,
}: UseRadioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triedFallbackRef = useRef<boolean>(false);
  const userWantsPlayRef = useRef<boolean>(false);
  const activeStationRef = useRef<RadioStation | null>(null);
  const preferLowDataRef = useRef<boolean>(preferLowData);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const stallTimerRef = useRef<number | null>(null);

  preferLowDataRef.current = preferLowData;

  const [currentStation, setCurrentStation] = useState<RadioStation | null>(
    () => stations[0] ?? null,
  );
  const [status, setStatus] = useState<PlaybackStatus>('stopped');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bufferSeconds, setBufferSeconds] = useState<number>(0);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
      }
    } catch {
      // ignore
    }
    return 0.85;
  });
  const [isMuted, setIsMuted] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionBytes, setSessionBytes] = useState(0);
  const [totalHistoricalBytes, setTotalHistoricalBytes] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(TOTAL_BYTES_STORAGE_KEY) || '0');
      return Number.isFinite(saved) ? saved : 0;
    } catch {
      return 0;
    }
  });

  const [sleepMinutes, setSleepMinutesState] = useState<SleepTimerMinutes>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);

  const clearRecoveryTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stallTimerRef.current !== null) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const getPreferredUrl = useCallback((station: RadioStation, useAlt = false): string => {
    if (useAlt) {
      return station.lowDataUrl || station.fallbackUrl || station.streamUrl;
    }
    return preferLowDataRef.current && station.lowDataUrl
      ? station.lowDataUrl
      : station.streamUrl;
  }, []);

  const closeStreamSocket = useCallback(() => {
    clearRecoveryTimers();
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setBufferSeconds(0);
  }, [clearRecoveryTimers]);

  const scheduleReconnect = useCallback(
    (reason: string) => {
      if (!userWantsPlayRef.current || !activeStationRef.current) return;

      if (!navigator.onLine) {
        setStatus('connecting');
        setErrorMessage('Sin conexión. Se reanudará automáticamente al volver la señal.');
        return;
      }

      const nextAttempt = reconnectAttemptRef.current + 1;
      if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
        userWantsPlayRef.current = false;
        setStatus('error');
        setReconnectAttempt(0);
        setErrorMessage('Señal inestable o caída tras varios reintentos. Tocá Escuchar para reintentar.');
        return;
      }

      reconnectAttemptRef.current = nextAttempt;
      setReconnectAttempt(nextAttempt);
      setStatus('connecting');
      setErrorMessage(reason);

      const delayMs = Math.min(10000, 1200 * Math.pow(1.6, nextAttempt - 1));
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        const audio = audioRef.current;
        const station = activeStationRef.current;
        if (!audio || !station || !userWantsPlayRef.current) return;

        const useAlt = nextAttempt % 2 === 0 && Boolean(station.fallbackUrl || station.lowDataUrl);
        const targetUrl = getPreferredUrl(station, useAlt);
        audio.src = targetUrl;
        audio.load();
        audio.play().catch(() => {
          scheduleReconnect('Reintentando conexión en red lenta...');
        });
      }, delayMs);
    },
    [getPreferredUrl],
  );

  // Initialize single audio element once with preload="none" + anti-stall recovery
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume;
    audio.muted = isMuted;
    audioRef.current = audio;

    const updateBufferReadout = () => {
      try {
        if (audio.buffered.length > 0) {
          const end = audio.buffered.end(audio.buffered.length - 1);
          const ahead = Math.max(0, end - audio.currentTime);
          setBufferSeconds(Number.isFinite(ahead) ? Number(ahead.toFixed(1)) : 0);
        }
      } catch {
        // ignore
      }
    };

    const startStallWatchdog = () => {
      if (!userWantsPlayRef.current) return;
      if (stallTimerRef.current !== null) window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = window.setTimeout(() => {
        if (userWantsPlayRef.current && (audio.paused || audio.readyState < 3)) {
          scheduleReconnect('Conexión lenta detectada, estabilizando señal...');
        }
      }, STALL_TIMEOUT_MS);
    };

    const handlePlaying = () => {
      clearRecoveryTimers();
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setStatus('playing');
      setErrorMessage(null);
      updateBufferReadout();
    };

    const handleWaiting = () => {
      if (!userWantsPlayRef.current) return;
      setStatus('connecting');
      updateBufferReadout();
      startStallWatchdog();
    };

    const handleStalled = () => {
      if (!userWantsPlayRef.current) return;
      updateBufferReadout();
      startStallWatchdog();
    };

    const handleEnded = () => {
      if (userWantsPlayRef.current) {
        scheduleReconnect('Transmisión interrumpida, reconectando...');
      }
    };

    const handleError = () => {
      if (!userWantsPlayRef.current) return;
      const active = activeStationRef.current;
      const altUrl = active ? active.lowDataUrl || active.fallbackUrl : undefined;
      if (active && altUrl && !triedFallbackRef.current) {
        triedFallbackRef.current = true;
        audio.src = altUrl;
        audio.load();
        audio.play().catch(() => {
          scheduleReconnect('Probando enlace alternativo...');
        });
        return;
      }
      scheduleReconnect('Señal interrumpida, reconectando...');
    };

    const handleOnline = () => {
      if (userWantsPlayRef.current && activeStationRef.current) {
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        setStatus('connecting');
        setErrorMessage('Conexión restablecida, retomando radio...');
        const targetUrl = getPreferredUrl(activeStationRef.current, false);
        audio.src = targetUrl;
        audio.load();
        audio.play().catch(() => {
          scheduleReconnect('Retomando señal...');
        });
      }
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('canplay', updateBufferReadout);
    audio.addEventListener('progress', updateBufferReadout);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    window.addEventListener('online', handleOnline);

    return () => {
      clearRecoveryTimers();
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('canplay', updateBufferReadout);
      audio.removeEventListener('progress', updateBufferReadout);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      window.removeEventListener('online', handleOnline);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [clearRecoveryTimers, getPreferredUrl, scheduleReconnect]);

  const playStation = useCallback(
    (station: RadioStation) => {
      const audio = audioRef.current;
      if (!audio) return;

      clearRecoveryTimers();
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);

      const isSwitching = activeStationRef.current?.id !== station.id;
      if (isSwitching) {
        setElapsedSeconds(0);
        setBufferSeconds(0);
      }

      triedFallbackRef.current = false;
      userWantsPlayRef.current = true;
      activeStationRef.current = station;
      setCurrentStation(station);
      setErrorMessage(null);
      setStatus('connecting');

      audio.src = getPreferredUrl(station, false);
      audio.volume = volume;
      audio.muted = isMuted;
      audio.load();
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const altUrl = station.lowDataUrl || station.fallbackUrl;
        if (altUrl && !triedFallbackRef.current) {
          triedFallbackRef.current = true;
          audio.src = altUrl;
          audio.load();
          audio.play().catch(() => {
            scheduleReconnect('No se pudo conectar, reintentando...');
          });
        } else {
          scheduleReconnect('No se pudo conectar, reintentando...');
        }
      });
    },
    [clearRecoveryTimers, getPreferredUrl, isMuted, scheduleReconnect, volume],
  );

  const togglePlayPause = useCallback(() => {
    if (!currentStation) {
      if (stations.length > 0) playStation(stations[0]);
      return;
    }
    if (status === 'playing' || status === 'connecting') {
      userWantsPlayRef.current = false;
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      closeStreamSocket();
      setStatus('paused');
      setErrorMessage(null);
    } else {
      playStation(currentStation);
    }
  }, [closeStreamSocket, currentStation, playStation, stations, status]);

  const stop = useCallback(() => {
    userWantsPlayRef.current = false;
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    closeStreamSocket();
    setStatus('stopped');
    setElapsedSeconds(0);
    setErrorMessage(null);
  }, [closeStreamSocket]);

  const playNext = useCallback(() => {
    if (stations.length === 0) return;
    const idx = currentStation ? stations.findIndex((s) => s.id === currentStation.id) : -1;
    const nextStation = stations[(idx + 1) % stations.length];
    if (nextStation) playStation(nextStation);
  }, [currentStation, playStation, stations]);

  const playPrev = useCallback(() => {
    if (stations.length === 0) return;
    const idx = currentStation ? stations.findIndex((s) => s.id === currentStation.id) : 0;
    const prevIdx = idx <= 0 ? stations.length - 1 : idx - 1;
    const prevStation = stations[prevIdx];
    if (prevStation) playStation(prevStation);
  }, [currentStation, playStation, stations]);

  const setVolume = useCallback(
    (val: number) => {
      const clamped = Math.min(1, Math.max(0, val));
      setVolumeState(clamped);
      if (audioRef.current) audioRef.current.volume = clamped;
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
        if (audioRef.current) audioRef.current.muted = false;
      }
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
    },
    [isMuted],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const setSleepTimer = useCallback((minutes: SleepTimerMinutes) => {
    setSleepMinutesState(minutes);
    setSleepRemainingSec(minutes * 60);
  }, []);

  // Tick elapsed time, effective bitrate data estimation, buffer telemetry & sleep timer
  useEffect(() => {
    if (status !== 'playing' || !currentStation) return;

    const effectiveBitrate =
      preferLowData && currentStation.lowDataUrl
        ? Math.min(currentStation.bitrate, 64)
        : currentStation.bitrate;

    const timer = window.setInterval(() => {
      const bytesPerSec = computeBytesForDuration(effectiveBitrate, 1);

      if (audioRef.current && audioRef.current.buffered.length > 0) {
        try {
          const end = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
          const ahead = Math.max(0, end - audioRef.current.currentTime);
          setBufferSeconds(Number.isFinite(ahead) ? Number(ahead.toFixed(1)) : 0);
        } catch {
          // ignore
        }
      }

      setElapsedSeconds((prev) => prev + 1);
      setSessionBytes((prev) => {
        const next = prev + bytesPerSec;
        if (sessionDataCapMB && next >= sessionDataCapMB * 1024 * 1024) {
          userWantsPlayRef.current = false;
          closeStreamSocket();
          setStatus('stopped');
          setErrorMessage(
            `Límite de ${sessionDataCapMB} MB alcanzado. Reproducción detenida.`,
          );
        }
        return next;
      });

      setTotalHistoricalBytes((prev) => {
        const next = prev + bytesPerSec;
        try {
          localStorage.setItem(TOTAL_BYTES_STORAGE_KEY, String(Math.round(next)));
        } catch {
          // ignore
        }
        return next;
      });

      setSleepRemainingSec((prev) => {
        if (prev <= 0) return 0;
        if (prev === 1) {
          userWantsPlayRef.current = false;
          closeStreamSocket();
          setStatus('stopped');
          setSleepMinutesState(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [closeStreamSocket, currentStation, preferLowData, sessionDataCapMB, status]);

  // Media Session API for Lock Screen & Notification Playback
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (currentStation) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentStation.name,
        artist: `${currentStation.frequency} · ${currentStation.city}`,
        album: 'RadioWin AR · En Vivo',
        artwork: [
          {src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png'},
          {src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png'},
        ],
      });
    }

    navigator.mediaSession.playbackState =
      status === 'playing' || status === 'connecting'
        ? 'playing'
        : status === 'paused'
          ? 'paused'
          : 'none';
  }, [currentStation, status]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      [
        'play',
        () => {
          if (currentStation) playStation(currentStation);
        },
      ],
      [
        'pause',
        () => {
          userWantsPlayRef.current = false;
          closeStreamSocket();
          setStatus('paused');
        },
      ],
      ['stop', stop],
      ['previoustrack', playPrev],
      ['nexttrack', playNext],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [closeStreamSocket, currentStation, playNext, playPrev, playStation, stop]);

  return {
    currentStation,
    status,
    errorMessage,
    bufferSeconds,
    reconnectAttempt,
    volume,
    isMuted,
    elapsedSeconds,
    sessionBytes,
    totalHistoricalBytes,
    sleepMinutes,
    sleepRemainingSec,
    playStation,
    togglePlayPause,
    stop,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    setSleepTimer,
  };
}
