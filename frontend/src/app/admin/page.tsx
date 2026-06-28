import PageHeader from '@/components/PageHeader'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

export default function AdminPage() {
  return (
    <>
      <PageHeader
        title="Administración"
        subtitle="Configuración del sistema y gestión del catálogo"
      />

      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center max-w-lg">
        <Cog6ToothIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-400">
          Panel de administración — disponible en MVP
        </p>
        <p className="text-xs text-gray-300 mt-1">
          Gestión de taxonomía, aprobaciones y configuración de proveedores
        </p>
      </div>
    </>
  )
}
