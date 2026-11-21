import React from 'react';
import {Star, Trash2, Volume2} from 'lucide-react';
import {PlaybackStatus, RadioStation} from '../types/radio';

interface FavoritesRackProps {
  favorites: RadioStation[];
  currentStationId: string | null;
  status: PlaybackStatus;
  onSelectStation: (station: RadioStation) => void;
  onRemoveFavorite: (id: string) => void;
}

export const FavoritesRack: React.FC<FavoritesRackProps> = ({
  favorites,
  currentStationId,
  status,
  onSelectStation,
  onRemoveFavorite,
}) => {
  return (
    <section
      aria-label="Favoritos"
      className="winamp-chassis rounded-2xl border border-zinc-300 bg-zinc-200/80 p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-[#171a21] min-w-0"
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-300/80 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            Favoritos
          </h2>
        </div>
        <span className="font-lcd text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          {favorites.length}
        </span>
      </div>

      {favorites.length === 0 ? (
        <p className="py-5 text-center text-xs text-zinc-600 dark:text-zinc-400">
          Marcá cualquier radio con la estrella para acceder rápido acá.
        </p>
      ) : (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {favorites.slice(0, 8).map((station, index) => {
            const isActive = currentStationId === station.id;
            const isPlaying = isActive && status === 'playing';
            return (
              <div
                key={station.id}
                className={`flex items-center rounded-xl border min-w-0 transition-colors ${
                  isActive
                    ? 'border-sky-500/60 bg-sky-500/15 text-zinc-900 dark:text-white'
                    : 'border-zinc-300/90 bg-white/80 text-zinc-800 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-800/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectStation(station)}
                  className="flex items-center gap-2 px-2.5 py-2 text-left min-w-0 flex-1 min-h-[46px]"
                >
                  <span
                    className={`font-lcd text-[11px] font-semibold shrink-0 ${
                      isActive ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{station.name}</div>
                    <div className="text-[11px] font-lcd text-zinc-500 dark:text-zinc-400 truncate">
                      {station.frequency}
                    </div>
                  </div>

                  {isPlaying && <Volume2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {favorites.length > 8 && (
        <div className="mt-2.5 pt-2 border-t border-zinc-300/70 dark:border-zinc-800 space-y-1">
          {favorites.slice(8).map((station) => (
            <div key={station.id} className="flex items-center justify-between gap-2 text-xs min-w-0">
              <button
                type="button"
                onClick={() => onSelectStation(station)}
                className="flex-1 text-left py-1.5 px-2 rounded-lg hover:bg-white/60 dark:hover:bg-zinc-800/60 truncate min-h-[40px]"
              >
                {station.name}
              </button>
              <button
                type="button"
                onClick={() => onRemoveFavorite(station.id)}
                aria-label={`Quitar ${station.name}`}
                className="flex items-center justify-center min-h-[40px] min-w-[40px] text-zinc-400 hover:text-rose-500 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
