'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  DocumentTextIcon,
  PlusCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { getMyPrompts, type MyPromptSummary } from '@/lib/api'

const CRITICIDAD_COLOR: Record<string, string> = {
  baja: 'bg-green-50 text-green-700',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-red-50 text-red-700',
}

const ESTADO_COLOR: Record<string, string> = {
  en_uso: 'text-green-600',
  generada: 'text-gray-400',
  propuesta: 'text-blue-500',
  aprobada: 'text-indigo-600',
  deprecada: 'text-red-400',
}

const OWNER = 'angel.llosa'

export default function MisPromptsPage() {
  const [prompts, setPrompts] = useState<MyPromptSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyPrompts(OWNER)
      .then(r => {
        setPrompts(r.prompts)
        setTotal(r.total)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  const personal = prompts.filter(p => p.estado === 'en_uso' || p.estado === 'generada')
  const propuestos = prompts.filter(p => p.estado === 'propuesta' || p.estado === 'aprobada')

  return (
    <>
      <PageHeader
        title="Mis prompts"
        subtitle="Prompts que has guardado o capturado"
        action={
          <Link
            href="/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white
                       text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Nuevo prompt
          </Link>
        }
      />

      {/* Stats row */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{personal.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Personales</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{propuestos.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Compartidos</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-4 max-w-lg">
          <ExclamationCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 max-w-2xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-12 ml-auto" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-5/6 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Prompt list */}
      {!loading && !error && prompts.length > 0 && (
        <div className="space-y-3 max-w-2xl">
          {prompts.map(p => <PromptRow key={p.id} prompt={p} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && prompts.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center max-w-lg">
          <DocumentTextIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Todavía no tienes prompts guardados</p>
          <p className="text-xs text-gray-300 mt-1 mb-4">
            Captura el primer prompt y empieza a construir tu catálogo
          </p>
          <Link
            href="/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white
                       text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Añadir primer prompt
          </Link>
        </div>
      )}
    </>
  )
}

function PromptRow({ prompt: p }: { prompt: MyPromptSummary }) {
  const date = new Date(p.creado_en).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3 hover:border-indigo-200 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {p.destacado && <StarSolid className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <h3 className="text-sm font-semibold text-gray-900 truncate">{p.titulo}</h3>
          <span className={`ml-auto shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${CRITICIDAD_COLOR[p.criticidad] ?? 'bg-gray-50 text-gray-500'}`}>
            {p.criticidad}
          </span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-1 mb-2">{p.proposito}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className={`font-medium ${ESTADO_COLOR[p.estado] ?? 'text-gray-400'}`}>
            {p.estado.replace('_', ' ')}
          </span>
          {p.variables_count > 0 && <span>{p.variables_count} var.</span>}
          {p.datos_sensibles && (
            <span className="flex items-center gap-0.5 text-red-400">
              <ExclamationTriangleIcon className="w-3 h-3" />
              PII
            </span>
          )}
          <span className="ml-auto">{date}</span>
        </div>
      </div>
      <Link
        href={`/prompts/${p.id}`}
        className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700 shrink-0 mt-0.5"
      >
        Usar <ChevronRightIcon className="w-3 h-3" />
      </Link>
    </div>
  )
}
