'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowTrendingUpIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { getStats, type StatsResponse } from '@/lib/api'

export default function AdminPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  const positiveRate =
    stats && (stats.total_valoraciones_positivas + stats.total_valoraciones_negativas) > 0
      ? Math.round(
          (stats.total_valoraciones_positivas /
            (stats.total_valoraciones_positivas + stats.total_valoraciones_negativas)) *
            100,
        )
      : null

  return (
    <>
      <PageHeader
        title="Administración"
        subtitle="Métricas de adopción del catálogo"
      />

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-6 max-w-2xl">
          <ExclamationCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Adoption metrics ── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Métricas globales
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
          <StatCard
            icon={DocumentTextIcon}
            label="Prompts en el catálogo"
            value={loading ? '—' : String(stats?.total_prompts ?? 0)}
            sub={loading ? undefined : `+${stats?.prompts_this_week ?? 0} esta semana`}
            accent="indigo"
          />
          <StatCard
            icon={ClipboardDocumentIcon}
            label="Usos registrados"
            value={loading ? '—' : String(stats?.total_usos ?? 0)}
            sub={loading ? undefined : `+${stats?.usos_this_week ?? 0} esta semana`}
            accent="blue"
          />
          <StatCard
            icon={HandThumbUpIcon}
            label="Valoraciones positivas"
            value={loading ? '—' : String(stats?.total_valoraciones_positivas ?? 0)}
            sub={
              positiveRate !== null
                ? `${positiveRate}% de satisfacción`
                : undefined
            }
            accent="green"
          />
          <StatCard
            icon={HandThumbDownIcon}
            label="Valoraciones negativas"
            value={loading ? '—' : String(stats?.total_valoraciones_negativas ?? 0)}
            accent="red"
          />
          <StatCard
            icon={ArrowTrendingUpIcon}
            label="Tasa de valoración"
            value={
              loading || !stats
                ? '—'
                : stats.total_usos > 0
                ? `${Math.round(((stats.total_valoraciones_positivas + stats.total_valoraciones_negativas) / stats.total_usos) * 100)}%`
                : 'n/a'
            }
            sub="valoraciones / usos"
            accent="purple"
          />
        </div>
      </section>

      {/* ── MVP placeholder ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Funcionalidades MVP
        </h2>
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center max-w-lg">
          <p className="text-sm font-medium text-gray-400">
            Gestión de taxonomía, aprobaciones y configuración de proveedores — disponibles en MVP
          </p>
        </div>
      </section>
    </>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent: 'indigo' | 'blue' | 'green' | 'red' | 'purple'
}) {
  const iconColor: Record<string, string> = {
    indigo: 'text-indigo-500',
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-400',
    purple: 'text-purple-500',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor[accent]}`} />
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
