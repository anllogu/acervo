import PageHeader from '@/components/PageHeader'
import { SparklesIcon } from '@heroicons/react/24/outline'

const PLACEHOLDER_DOMAINS = ['Legal', 'Operaciones', 'Comunicación', 'RR.HH.', 'Finanzas']

export default function DescubrirPage() {
  return (
    <>
      <PageHeader
        title="Descubrir"
        subtitle="Explora el catálogo de prompts de la organización"
      />

      {/* Domain filter chips — Phase 5 will wire these */}
      <div className="flex gap-2 flex-wrap mb-6">
        {PLACEHOLDER_DOMAINS.map((domain) => (
          <button
            key={domain}
            className="px-3 py-1 text-xs font-medium rounded-full border border-gray-200
                       bg-white text-gray-600 hover:border-indigo-400 hover:text-indigo-600
                       transition-colors"
          >
            {domain}
          </button>
        ))}
      </div>

      {/* Featured prompts — Phase 1 will populate from API */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Prompts destacados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse"
            >
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
      </section>

      {/* Explore by task type — Phase 5 */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Por tipo de tarea
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Extracción', 'Clasificación', 'Generación', 'Razonamiento'].map((tipo) => (
            <div
              key={tipo}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4
                         flex items-center gap-3 cursor-default opacity-50"
            >
              <SparklesIcon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 font-medium">{tipo}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
