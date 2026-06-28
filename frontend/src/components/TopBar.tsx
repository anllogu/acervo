import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar... (Cmd+K)"
          readOnly
          className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg w-64
                     text-gray-500 cursor-pointer
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900 leading-tight">Angel Llosa</p>
          <p className="text-xs text-gray-500 leading-tight">anllogui@gmail.com</p>
        </div>
        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center
                        text-white text-sm font-semibold flex-shrink-0">
          AL
        </div>
      </div>
    </header>
  )
}
