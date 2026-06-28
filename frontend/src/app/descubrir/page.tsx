'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  DocumentTextIcon,
  TagIcon,
  PencilSquareIcon,
  LightBulbIcon,
  SparklesIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { discoverPrompts, getFacets, type SearchCandidate } from '@/lib/api'

const CRITICIDAD_COLOR: Record<string, string> = {
  baja: 'bg-green-50 text-green-700',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-red-50 text-red-700',
}

const TAREA_ICON: Record<string, React.ElementType> = {
  extraccion: DocumentTextIcon,
  clasificacion: TagIcon,
  generacion: PencilSquareIcon,
  razonamiento: LightBulbIcon,
}

const TAREA_LABEL: Record<string, string> = {
  extraccion: 'Extracción',
  clasificacion: 'Clasificación',
  generacion: 'Generación',
  razonamiento: 'Razonamiento',
}

export default function DescubrirPage() {
  const [prompts, setPrompts] = useState<SearchCandidate[]>([])
  const [domains, setDomains] = useState<string[]>([])
  const [tareas, setTareas] = useState<string[]>([])
  const [activeDomain, setActiveDomain] = useState<string | null>(null)
  const [activeTarea, setActiveTarea] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFacets()
      .then(f => {
        setDomains(f.dominio_negocio)
        setTareas(f.tipo_tarea)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    discoverPrompts(
      activeDomain ? [activeDomain] : [],
      activeTarea ? [activeTarea] : [],
    )
      .then(r => setPrompts(r.prompts))
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [activeDomain, activeTarea])

  const featured = prompts.filter(p => p.destacado)
  const rest = prompts.filter(p => !p.destacado)

  function toggleDomain(d: string) {
    setActiveDomain(prev => prev === d ? null : d)
  }
  function toggleTarea(t: string) {
    setActiveTarea(prev => prev === t ? null : t)
  }

  return (
    <>
      <PageHeader
        title="Descubrir"
        subtitle="Explora el catálogo de prompts de la organización"
      />

      {/* Domain filter chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => { setActiveDomain(null); setActiveTarea(null) }}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            activeDomain === null && activeTarea === null
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
          }`}
        >
          Todos
        </button>
        {domains.map(domain => (
          <button
            key={domain}
            onClick={() => toggleDomain(domain)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors capitalize ${
              activeDomain === domain
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {domain.charAt(0).toUpperCase() + domain.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-4">
          <ExclamationCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-5/6 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
              <div className="flex gap-2 mt-4">
                <div className="h-5 bg-gray-100 rounded-full w-16" />
                <div className="h-5 bg-gray-100 rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Featured prompts */}
          {featured.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Prompts destacados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {featured.map(p => <PromptCard key={p.id} prompt={p} />)}
              </div>
            </section>
          )}

          {/* Rest of prompts */}
          {rest.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Más prompts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rest.map(p => <PromptCard key={p.id} prompt={p} />)}
              </div>
            </section>
          )}

          {prompts.length === 0 && !error && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
              <SparklesIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No hay prompts en esta categoría</p>
            </div>
          )}
        </>
      )}

      {/* Explore by task type */}
      <section className="mt-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Por tipo de tarea
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(tareas.length > 0 ? tareas : Object.keys(TAREA_LABEL)).map(tarea => {
            const Icon = TAREA_ICON[tarea] ?? SparklesIcon
            const label = TAREA_LABEL[tarea] ?? (tarea.charAt(0).toUpperCase() + tarea.slice(1))
            const active = activeTarea === tarea
            return (
              <button
                key={tarea}
                onClick={() => toggleTarea(tarea)}
                className={`rounded-xl border shadow-sm p-4 flex items-center gap-3 transition-colors text-left ${
                  active
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-indigo-500' : 'text-indigo-400'}`} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function PromptCard({ prompt: p }: { prompt: SearchCandidate }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3 hover:border-indigo-200 transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {p.destacado && <StarSolid className="w-4 h-4 text-amber-400 shrink-0" />}
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{p.titulo}</h3>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${CRITICIDAD_COLOR[p.criticidad] ?? 'bg-gray-50 text-gray-500'}`}>
          {p.criticidad}
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">{p.proposito}</p>

      {p.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.tags.slice(0, 4).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full border border-gray-100">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {p.dominio_negocio.map(d => (
            <span key={d} className="text-xs text-blue-500 capitalize">{d}</span>
          ))}
          {p.variables_count > 0 && (
            <span className="text-xs text-gray-400">{p.variables_count} var.</span>
          )}
        </div>
        <Link
          href={`/prompts/${p.id}`}
          className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700 shrink-0"
        >
          Usar <ChevronRightIcon className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
