'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import {
  recommendPrompts,
  type RecommendCandidate,
  type IntentParsed,
} from '@/lib/api'

const CRITICIDAD_COLOR: Record<string, string> = {
  baja: 'bg-green-50 text-green-700',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-red-50 text-red-700',
}

function BuscarContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [intent, setIntent] = useState<IntentParsed | null>(null)
  const [candidates, setCandidates] = useState<RecommendCandidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    router.replace(`/buscar${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })

    if (query.trim().length < 3) {
      setCandidates(null)
      setIntent(null)
      setError(null)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await recommendPrompts({ descripcion: query.trim() })
        setIntent(result.intent)
        setCandidates(result.candidates)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al buscar')
        setCandidates(null)
        setIntent(null)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <>
      <PageHeader
        title="Buscar"
        subtitle="Describe tu tarea y te encontramos el prompt adecuado"
      />

      <div className="max-w-2xl space-y-5">
        {/* ── Search input ── */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ej: necesito sacar las acciones de un acta de reunión..."
            className="w-full pl-12 pr-4 py-3.5 text-sm bg-white border border-gray-200 rounded-xl
                       shadow-sm text-gray-800 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
          {loading && (
            <ArrowPathIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
          )}
        </div>

        {/* ── Intent chips ── */}
        {intent && (intent.dominio_negocio.length > 0 || intent.tipo_tarea.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium shrink-0">Entendido como:</span>
            {intent.dominio_negocio.map(d => (
              <span key={d} className="px-2.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                {d}
              </span>
            ))}
            {intent.tipo_tarea.map(t => (
              <span key={t} className="px-2.5 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <ExclamationCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── Results ── */}
        {candidates !== null && candidates.length === 0 && !loading && (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
            <MagnifyingGlassIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-400">Sin resultados</p>
            <p className="text-xs text-gray-300 mt-1">
              Prueba con otras palabras o una descripción más detallada
            </p>
          </div>
        )}

        {candidates !== null && candidates.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              {candidates.length} resultado{candidates.length !== 1 ? 's' : ''}
            </p>
            {candidates.map(c => (
              <ResultCard key={c.id} candidate={c} />
            ))}
          </div>
        )}

        {/* ── Empty state (no query yet) ── */}
        {candidates === null && !loading && !error && (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <MagnifyingGlassIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">
              Describe tu tarea para encontrar el prompt ideal
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Mínimo 3 caracteres para iniciar la búsqueda
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default function BuscarPage() {
  return (
    <Suspense>
      <BuscarContent />
    </Suspense>
  )
}

function ResultCard({ candidate: c }: { candidate: RecommendCandidate }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3 hover:border-indigo-200 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {c.destacado && (
            <StarSolid className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <h3 className="text-sm font-semibold text-gray-900 truncate">{c.titulo}</h3>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${CRITICIDAD_COLOR[c.criticidad] ?? 'bg-gray-50 text-gray-500'}`}
        >
          {c.criticidad}
        </span>
      </div>

      {/* Propósito */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{c.proposito}</p>

      {/* Explicación LLM */}
      {c.cuando_usarlo && (
        <p className="text-xs text-indigo-500 italic leading-relaxed">{c.cuando_usarlo}</p>
      )}

      {/* Tags */}
      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 5).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full border border-gray-100"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {c.dominio_negocio.map(d => (
            <span key={d} className="text-xs text-blue-500">{d}</span>
          ))}
          {c.tipo_tarea.map(t => (
            <span key={t} className="text-xs text-purple-500">{t}</span>
          ))}
          {c.variables_count > 0 && (
            <span className="text-xs text-gray-400">
              {c.variables_count} variable{c.variables_count !== 1 ? 's' : ''}
            </span>
          )}
          {c.datos_sensibles && (
            <span className="text-xs text-red-400">PII</span>
          )}
        </div>
        <Link
          href={`/prompts/${c.id}`}
          className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700 shrink-0"
        >
          Usar <ChevronRightIcon className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
