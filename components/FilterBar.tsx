'use client'

export interface ActiveFilters {
  gender: 'all' | 'men' | 'women' | 'nonBinary'
  ageRanges: string[]
  painValues: string[]
}

export interface FilterOptions {
  ageRanges: string[]
  painValues?: string[]
}

interface FilterBarProps {
  filterOptions: FilterOptions
  activeFilters: ActiveFilters
  totalFiltered: number
  totalAll: number
  onChange: (filters: ActiveFilters) => void
  /** Etiqueta del filtro multi-valor (p. ej. texto del encabezado de la columna [filtro] en Sheets). */
  secondaryFilterLabel?: string
}

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value]
}

const GENDER_OPTIONS: { value: ActiveFilters['gender']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'men', label: 'Hombres' },
  { value: 'women', label: 'Mujeres' },
  { value: 'nonBinary', label: 'No binario' },
]


export function FilterBar({
  filterOptions,
  activeFilters,
  totalFiltered,
  totalAll,
  onChange,
  secondaryFilterLabel = 'Dolor crónico',
}: FilterBarProps) {
  const isFiltered =
    activeFilters.gender !== 'all' ||
    (activeFilters.ageRanges?.length ?? 0) > 0 ||
    (activeFilters.painValues?.length ?? 0) > 0

  function set<K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) {
    onChange({ ...activeFilters, [key]: value })
  }

  function reset() {
    onChange({ ...activeFilters, gender: 'all', ageRanges: [], painValues: [] })
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtrar respuestas</p>
        <div className="flex items-center gap-3">
          {isFiltered && (
            <span className="text-xs text-violet-600 font-medium">
              {totalFiltered} de {totalAll} respuestas
            </span>
          )}
          {isFiltered && (
            <button
              onClick={reset}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {/* Género */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">Género</p>
          <div className="flex gap-1.5 flex-wrap">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set('gender', opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeFilters.gender === opt.value
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Edad */}
        {filterOptions.ageRanges.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium">
              Edad
              {activeFilters.ageRanges.length > 0 && (
                <span className="ml-1.5 text-violet-600">({activeFilters.ageRanges.length} seleccionadas)</span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {filterOptions.ageRanges.map((range) => {
                const active = activeFilters.ageRanges.includes(range)
                return (
                  <button
                    key={range}
                    onClick={() => set('ageRanges', toggleValue(activeFilters.ageRanges, range))}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                    }`}
                  >
                    {range}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Filtro por columna marcada [filtro] o primera [closed] (potenciales) */}
        {(filterOptions.painValues?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium">
              {secondaryFilterLabel}
              {(activeFilters.painValues?.length ?? 0) > 0 && (
                <span className="ml-1.5 text-violet-600">({activeFilters.painValues!.length} seleccionados)</span>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {filterOptions.painValues!.map((val) => {
                const active = (activeFilters.painValues ?? []).includes(val)
                return (
                  <button
                    key={val}
                    onClick={() => set('painValues', toggleValue(activeFilters.painValues ?? [], val))}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                    }`}
                  >
                    {val}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
