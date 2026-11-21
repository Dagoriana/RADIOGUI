import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Moon, Radio, Star, Sun} from 'lucide-react';
import {FavoritesRack} from './components/FavoritesRack';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PWAInstallButton} from './components/PWAInstallButton';
import {StationTuner} from './components/StationTuner';
import {WinampDeck} from './components/WinampDeck';
import {ARGENTINE_STATIONS, DEFAULT_FAVORITE_IDS} from './data/argentineStations';
import {useRadioPlayer} from './hooks/useRadioPlayer';
import {DataSaverMode, RadioStation, StationCategory} from './types/radio';
import {fetchArgentineDirectory, readCachedDirectory, runAutomaticCacheHygiene} from './utils/cacheManager';

type ActiveView = 'tuner' | 'favorites';

const FAVORITES_KEY = 'radiowin_favorites_v1';
const CUSTOM_STATIONS_KEY = 'radiowin_custom_stations_v1';
const DATA_MODE_KEY = 'radiowin_data_mode_v1';
const THEME_KEY = 'radiowin_theme_v1';

interface NetworkInfoLike {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
}

function readNetworkSnapshot(): {isWifi: boolean | null; isSlow: boolean; osSaveData: boolean} {
  try {
    const conn = (navigator as unknown as {connection?: NetworkInfoLike}).connection;
    if (!conn) return {isWifi: null, isSlow: false, osSaveData: false};
    const isWifi =
      conn.type === 'wifi' || conn.type === 'ethernet'
        ? true
        : conn.type === 'cellular'
          ? false
          : null;
    const isSlow =
      conn.effectiveType === 'slow-2g' ||
      conn.effectiveType === '2g' ||
      (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 0.45);
    return {isWifi, isSlow, osSaveData: Boolean(conn.saveData)};
  } catch {
    return {isWifi: null, isSlow: false, osSaveData: false};
  }
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  const [activeView, setActiveView] = useState<ActiveView>('tuner');

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_FAVORITE_IDS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds]);

  const [customStations, setCustomStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_STATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_STATIONS_KEY, JSON.stringify(customStations));
    } catch {
      // ignore
    }
  }, [customStations]);

  // Mobile Data Saver Mode ('auto-wifi' disables automatically when WiFi is active)
  const [dataSaverMode, setDataSaverMode] = useState<DataSaverMode>(() => {
    try {
      const saved = localStorage.getItem(DATA_MODE_KEY) as DataSaverMode | null;
      if (saved === 'auto-wifi' || saved === 'always' || saved === 'off') return saved;
    } catch {
      // ignore
    }
    return 'auto-wifi';
  });

  const handleDataSaverModeChange = useCallback((mode: DataSaverMode) => {
    setDataSaverMode(mode);
    try {
      localStorage.setItem(DATA_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const [networkState, setNetworkState] = useState(readNetworkSnapshot);

  useEffect(() => {
    const conn = (navigator as unknown as {connection?: NetworkInfoLike}).connection;
    if (!conn?.addEventListener) return;
    const onChange = () => setNetworkState(readNetworkSnapshot());
    conn.addEventListener('change', onChange);
    return () => conn.removeEventListener?.('change', onChange);
  }, []);

  const isDataSaverActive = useMemo(() => {
    if (dataSaverMode === 'always') return true;
    if (dataSaverMode === 'off') return false;
    // auto-wifi: disable on fast WiFi/Ethernet; activate on cellular, OS Save-Data, or very slow networks
    if (networkState.isWifi === true && !networkState.osSaveData && !networkState.isSlow) return false;
    return true;
  }, [dataSaverMode, networkState.isSlow, networkState.isWifi, networkState.osSaveData]);

  // Silent background cache hygiene + cached directory load (zero network overhead on repeat visits)
  const [directoryStations, setDirectoryStations] = useState<RadioStation[]>([]);

  useEffect(() => {
    let active = true;
    runAutomaticCacheHygiene().then(() =>
      readCachedDirectory().then((cached) => {
        if (!active) return;
        if (cached && cached.stations.length > 0) {
          setDirectoryStations(cached.stations);
        } else if (!isDataSaverActive) {
          fetchArgentineDirectory()
            .then((list) => {
              if (active && list.length > 0) setDirectoryStations(list);
            })
            .catch(() => {
              // Keep curated stations silently
            });
        }
      }),
    );
    return () => {
      active = false;
    };
  }, [isDataSaverActive]);

  const allStations = useMemo(() => {
    const map = new Map<string, RadioStation>();
    for (const s of [...customStations, ...ARGENTINE_STATIONS, ...directoryStations]) {
      const urlKey = s.streamUrl.toLowerCase();
      if (!map.has(urlKey)) map.set(urlKey, s);
    }
    return Array.from(map.values());
  }, [customStations, directoryStations]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const favoriteStations = useMemo(() => {
    const byId = new Map(allStations.map((s) => [s.id, s]));
    return favoriteIds
      .map((id) => byId.get(id))
      .filter((s): s is RadioStation => Boolean(s));
  }, [allStations, favoriteIds]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<StationCategory>('todas');

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allStations.filter((station) => {
      if (activeCategory === 'favoritas' && !favoriteSet.has(station.id)) return false;
      if (activeCategory === 'bajo-consumo' && station.bitrate > 64) return false;
      if (
        activeCategory !== 'todas' &&
        activeCategory !== 'favoritas' &&
        activeCategory !== 'bajo-consumo' &&
        station.category !== activeCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        station.name.toLowerCase().includes(q) ||
        station.frequency.toLowerCase().includes(q) ||
        station.city.toLowerCase().includes(q) ||
        station.province.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, allStations, favoriteSet, searchQuery]);

  const player = useRadioPlayer({
    stations: filteredStations.length > 0 ? filteredStations : allStations,
    sessionDataCapMB: null,
    preferLowData: isDataSaverActive,
  });

  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev],
    );
  }, []);

  const handleAddCustomStation = useCallback(
    (stationInput: Omit<RadioStation, 'id'>) => {
      const newStation: RadioStation = {
        ...stationInput,
        id: `custom-${Date.now()}`,
      };
      setCustomStations((prev) => [newStation, ...prev]);
      setFavoriteIds((prev) => [newStation.id, ...prev]);
      player.playStation(newStation);
    },
    [player],
  );

  const handleRemoveCustomStation = useCallback(
    (id: string) => {
      setCustomStations((prev) => prev.filter((item) => item.id !== id));
      setFavoriteIds((prev) => prev.filter((item) => item !== id));
      if (player.currentStation?.id === id) {
        player.stop();
      }
    },
    [player],
  );

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    if (view === 'favorites') {
      setActiveCategory('favoritas');
    } else if (activeCategory === 'favoritas') {
      setActiveCategory('todas');
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col bg-zinc-100 text-zinc-900 dark:bg-[#0d0f13] dark:text-zinc-100 transition-colors">
      {/* Minimalist Top Bar (Zero horizontal overflow on mobile) */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-zinc-100/90 backdrop-blur-md dark:border-zinc-800/90 dark:bg-[#0d0f13]/90">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('tuner');
            }}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
          >
            RadioWin AR
          </a>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400"
          >
            <button
              type="button"
              onClick={() => handleNavClick('tuner')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-zinc-900 dark:hover:text-white ${
                activeView === 'tuner'
                  ? 'text-zinc-900 dark:text-white underline decoration-sky-500 decoration-2 underline-offset-8'
                  : ''
              }`}
            >
              Sintonizador
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('favorites')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-zinc-900 dark:hover:text-white ${
                activeView === 'favorites'
                  ? 'text-zinc-900 dark:text-white underline decoration-sky-500 decoration-2 underline-offset-8'
                  : ''
              }`}
            >
              Favoritos
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="winamp-btn inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-2.5 sm:px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 min-h-[40px] whitespace-nowrap"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isDark ? 'Claro' : 'Oscuro'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Minimalist Winamp Console */}
      <main
        id="top"
        className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-6 pt-4 pb-20 md:pb-8 min-w-0"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Winamp Player + Favorites Quick Access */}
          <div className="lg:col-span-5 space-y-4 min-w-0">
            <WinampDeck
              station={player.currentStation}
              status={player.status}
              errorMessage={player.errorMessage}
              bufferSeconds={player.bufferSeconds}
              reconnectAttempt={player.reconnectAttempt}
              volume={player.volume}
              isMuted={player.isMuted}
              elapsedSeconds={player.elapsedSeconds}
              sessionBytes={player.sessionBytes}
              sleepMinutes={player.sleepMinutes}
              sleepRemainingSec={player.sleepRemainingSec}
              isFavorite={player.currentStation ? favoriteSet.has(player.currentStation.id) : false}
              dataSaverMode={dataSaverMode}
              isDataSaverActive={isDataSaverActive}
              isOnWifi={networkState.isWifi}
              isSlowConnection={networkState.isSlow}
              onTogglePlayPause={player.togglePlayPause}
              onStop={player.stop}
              onPrev={player.playPrev}
              onNext={player.playNext}
              onVolumeChange={player.setVolume}
              onToggleMute={player.toggleMute}
              onToggleFavorite={handleToggleFavorite}
              onSleepChange={player.setSleepTimer}
              onDataSaverModeChange={handleDataSaverModeChange}
            />

            <div className={activeView === 'favorites' ? 'block' : 'hidden lg:block'}>
              <FavoritesRack
                favorites={favoriteStations}
                currentStationId={player.currentStation?.id ?? null}
                status={player.status}
                onSelectStation={player.playStation}
                onRemoveFavorite={handleToggleFavorite}
              />
            </div>
          </div>

          {/* Right Column: Station Tuner */}
          <div className={`lg:col-span-7 min-w-0 ${activeView === 'favorites' ? 'hidden lg:block' : 'block'}`}>
            <StationTuner
              stations={filteredStations}
              favoriteIds={favoriteSet}
              currentStationId={player.currentStation?.id ?? null}
              status={player.status}
              searchQuery={searchQuery}
              activeCategory={activeCategory}
              dataSaverActive={isDataSaverActive}
              onSearchChange={setSearchQuery}
              onCategoryChange={setActiveCategory}
              onSelectStation={player.playStation}
              onToggleFavorite={handleToggleFavorite}
              onAddCustomStation={handleAddCustomStation}
              onRemoveCustomStation={handleRemoveCustomStation}
            />
          </div>
        </div>
      </main>

      {/* Mobile Minimalist Bottom Bar (Only 2 tabs: Sintonizador & Favoritos) */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-zinc-100/95 backdrop-blur-md dark:border-zinc-800 dark:bg-[#0d0f13]/95"
      >
        <div className="grid grid-cols-2 h-14">
          <button
            type="button"
            onClick={() => handleNavClick('tuner')}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] ${
              activeView === 'tuner'
                ? 'text-sky-600 dark:text-sky-400 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Radio className="w-5 h-5" />
            <span className="text-[11px]">Sintonizador</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('favorites')}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] ${
              activeView === 'favorites'
                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Star className="w-5 h-5" />
            <span className="text-[11px]">Favoritos</span>
          </button>
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
