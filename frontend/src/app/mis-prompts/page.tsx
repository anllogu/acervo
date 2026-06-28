import PageHeader from '@/components/PageHeader'
import Link from 'next/link'
import { DocumentTextIcon, PlusCircleIcon } from '@heroicons/react/24/outline'

export default function MisPromptsPage() {
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

      {/* Stats row — Phase 1 will populate */}
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg">
        {[
          { label: 'Personales', value: '—' },
          { label: 'Compartidos', value: '—' },
          { label: 'Aprobados', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
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
    </>
  )
}
