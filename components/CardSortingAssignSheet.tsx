import { useEffect, useMemo } from 'react'

export type AssignSheetCategory = { id: string; label: string }

export function CardSortingAssignSheet({
  open,
  cardLabel,
  categories,
  onAssign,
  onClose,
}: {
  open: boolean
  cardLabel: string
  categories: AssignSheetCategory[]
  onAssign: (categoryId: string | null) => void
  onClose: () => void
}) {
  const ordered = useMemo(() => {
    return [...categories].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [categories])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" role="presentation" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-sorting-assign-title"
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-2xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="card-sorting-assign-title" className="text-sm font-semibold text-gray-900">
              Mover tarjeta
            </h2>
            <p className="mt-0.5 text-sm text-gray-600 truncate">{cardLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onAssign(null)}
            className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm font-medium text-amber-950"
          >
            Sin clasificar
          </button>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Categorías</p>
            <div className="max-h-[50vh] overflow-y-auto overscroll-contain space-y-2 pr-1">
              {ordered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onAssign(c.id)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
                >
                  {c.label}
                </button>
              ))}
              {ordered.length === 0 && <p className="text-sm text-gray-400">No hay categorías aún.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

