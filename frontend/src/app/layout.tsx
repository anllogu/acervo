import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Acervo',
  description: 'Catálogo de prompts de la organización',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 antialiased`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
