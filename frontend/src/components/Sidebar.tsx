'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  SparklesIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  PlusCircleIcon,
  Cog6ToothIcon,
  BookOpenIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline'

const NAV_GROUPS = [
  {
    label: 'CATÁLOGO',
    items: [
      { label: 'Descubrir', href: '/descubrir', icon: SparklesIcon },
      { label: 'Buscar', href: '/buscar', icon: MagnifyingGlassIcon },
    ],
  },
  {
    label: 'MIS PROMPTS',
    items: [
      { label: 'Mis prompts', href: '/mis-prompts', icon: DocumentTextIcon },
      { label: 'Nuevo prompt', href: '/nuevo', icon: PlusCircleIcon },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { label: 'Administración', href: '/admin', icon: Cog6ToothIcon },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`
        flex flex-col bg-gray-900 text-white flex-shrink-0
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-16' : 'w-52'}
      `}
    >
      {/* Logo + product name */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpenIcon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Acervo</p>
              <p className="text-[10px] text-gray-400 leading-tight">SEIDOR</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto">
            <BookOpenIcon className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`
            p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0
            ${collapsed ? 'mx-auto mt-2' : ''}
          `}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <ChevronLeftIcon
            className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="px-4 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`
                    flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg text-sm
                    transition-colors duration-150 group
                    ${active
                      ? 'bg-indigo-950 border-l-2 border-indigo-500 text-white font-medium pl-[9px]'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800 border-l-2 border-transparent'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
