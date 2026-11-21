import React, {useState} from 'react';
import {Plus, Search, Star, Trash2, Volume2, X} from 'lucide-react';
import {PlaybackStatus, RadioStation, StationCategory} from '../types/radio';

interface StationTunerProps {
  stations: RadioStation[];
  favoriteIds: Set<string>;
  currentStationId: string | null;
  status: PlaybackStatus;
  searchQuery: string;
  activeCategory: StationCategory;
  dataSaverActive: boolean;
  onSearchChange: (q: string) => void;
  onCategoryChange: (cat: StationCategory) => void;
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (id: string) => void;
  onAddCustomStation: (station: Omit<RadioStation, 'id'>) => void;
  onRemoveCustomStation: (id: string) => void;
}

const CATEGORIES: Array<{id: StationCategory; label: string}> = [
  {id: 'todas', label: 'Todas'},
  {id: 'favoritas', label: 'Favoritas'},
  {id: 'bajo-consumo', label: '≤ 64k'},
  {id: 'noticias', label: 'Noticias'},
  {id: 'rock', label: 'Rock'},
  {id: 'musica', label: 'Música'},
  {id: 'provincias', label: 'Provincias'},
];

export const StationTuner: React.FC<StationTunerProps> = ({
  stations,
  favoriteIds,
  currentStationId,
  status,
  searchQuery,
  activeCategory,
  dataSaverActive,
  onSearchChange,
  onCategoryChange,
  onSelectStation,
  onToggleFavorite,
  onAddCustomStation,
  onRemoveCustomStation,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFreq, setCustomFreq] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customName.trim();
    const trimmedUrl = customUrl.trim();
    if (!trimmedName || !trimmedUrl) {
      setFormError('Ingresá el nombre y la URL del stream.');
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
      setFormError('La URL debe empezar con https:// o http://.');
      return;
    }

    onAddCustomStation({
      name: trimmedName,
      frequency: customFreq.trim() || 'Stream',
      city: 'Personalizada',
      province: 'Argentina',
      genre: 'Personalizada',
      category: 'musica',
      streamUrl: trimmedUrl,
      bitrate: 64,
      codec: trimmedUrl.toLowerCase().includes('aac') ? 'AAC+' : 'MP3',
      isCustom: true,
    });

    setCustomName('');
    setCustomFreq('');
    setCustomUrl('');
    setFormError(null);
    setShowAddForm(false);
  };

  return (
    <section
      aria-label="Lista de emisoras"
      className="winamp-chassis rounded-2xl border border-zinc-300 bg-zinc-200/80 p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-[#171a21] min-w-0"
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-300/80 dark:border-zinc-800">
        <div className="min-w-0">
          <h2 className="font-display text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            Emisoras Argentinas
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {stations.length} radios{dataSaverActive ? ' · Ahorro ≤ 64k' : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="winamp-btn inline-flex items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 min-h-[40px] shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>URL</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="mt-3 rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Agregar stream personalizado
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              aria-label="Cerrar"
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nombre de la radio"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              type="text"
              value={customFreq}
              onChange={(e) => setCustomFreq(e.target.value)}
              placeholder="Frecuencia (ej. 95.9 FM)"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://servidor.com/stream.aac"
              className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-lcd text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="winamp-btn rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 min-h-[38px] shrink-0"
            >
              Guardar
            </button>
          </div>
          {formError && <p className="text-xs text-rose-500">{formError}</p>}
        </form>
      )}

      {/* Search + Wrapped Category Filter (Zero horizontal scroll!) */}
      <div className="mt-3 space-y-2.5">
        <div className="relative">
          <Search
            className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar radio, ciudad o frecuencia..."
            aria-label="Buscar emisora"
            className="w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-9 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Filtrar por categoría"
          className="flex flex-wrap items-center gap-1.5"
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(cat.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors min-h-[36px] ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'bg-white/75 text-zinc-700 hover:bg-white dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playlist Rows */}
      <div className="mt-3 rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-[#0e1116] overflow-hidden">
        {stations.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Sin resultados para ese filtro.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80 max-h-[520px] overflow-y-auto">
            {stations.map((station, idx) => {
              const isSelected = currentStationId === station.id;
              const isLive = isSelected && status === 'playing';
              const isFav = favoriteIds.has(station.id);

              return (
                <li
                  key={station.id}
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-1 transition-colors min-w-0 ${
                    isSelected
                      ? 'bg-sky-500/12 dark:bg-sky-500/15'
                      : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectStation(station)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left py-2 min-h-[48px]"
                  >
                    <span
                      className={`font-lcd text-xs w-5 text-right shrink-0 ${
                        isSelected
                          ? 'text-sky-600 dark:text-sky-400 font-semibold'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {isLive ? (
                        <Volume2 className="w-3.5 h-3.5 inline text-emerald-500" aria-label="En vivo" />
                      ) : (
                        String(idx + 1).padStart(2, '0')
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium truncate ${
                          isSelected
                            ? 'text-sky-700 dark:text-sky-300 font-semibold'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {station.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {station.frequency} · {station.city}
                      </div>
                    </div>

                    <span className="font-lcd text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 pr-1">
                      {station.bitrate}k
                    </span>
                  </button>

                  <div className="flex items-center shrink-0">
                    {station.isCustom && (
                      <button
                        type="button"
                        onClick={() => onRemoveCustomStation(station.id)}
                        aria-label={`Eliminar radio personalizada ${station.name}`}
                        title="Eliminar radio personalizada"
                        className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-zinc-400 hover:text-rose-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onToggleFavorite(station.id)}
                      aria-label={isFav ? `Quitar ${station.name}` : `Guardar ${station.name}`}
                      className={`flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg shrink-0 ${
                        isFav
                          ? 'text-amber-500'
                          : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
