'use client'

import { useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { capturePrompt, createPrompt, type CaptureResponse, type MetadataPropuesta } from '@/lib/api'

type Step = 'idle' | 'analyzing' | 'review' | 'saving' | 'success'

const TAGS_SUGERIDOS = ['legal', 'reuniones', 'email', 'contrato', 'rrhh', 'finanzas', 'resumen']

export default function NuevoPage() {
  const [step, setStep] = useState<Step>('idle')
  const [texto, setTexto] = useState('')
  const [capture, setCapture] = useState<CaptureResponse | null>(null)
  const [titulo, setTitulo] = useState('')
  const [metadata, setMetadata] = useState<MetadataPropuesta | null>(null)
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    if (texto.trim().length < 10) return
    setError(null)
    setStep('analyzing')
    try {
      const result = await capturePrompt(texto)
      setCapture(result)
      const m = result.metadata_propuesta
      setMetadata(m)
      setTitulo('')
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar el prompt')
      setStep('idle')
    }
  }

  async function handleSave() {
    if (!metadata || !titulo.trim()) return
    setStep('saving')
    try {
      const result = await createPrompt({ texto, titulo, metadata })
      setCreated(result)
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar el prompt')
      setStep('review')
    }
  }

  function toggleTag(tag: string) {
    if (!metadata) return
    const tags = metadata.tags.includes(tag)
      ? metadata.tags.filter(t => t !== tag)
      : [...metadata.tags, tag]
    setMetadata({ ...metadata, tags })
  }

  function handleReset() {
    setStep('idle')
    setTexto('')
    setCapture(null)
    setMetadata(null)
    setTitulo('')
    setCreated(null)
    setError(null)
  }

  return (
    <>
      <PageHeader
        title="Nuevo prompt"
        subtitle="Añade un prompt al catálogo con metadatos generados automáticamente"
      />

      <div className="max-w-2xl space-y-5">

        {/* Error banner */}
        {error && (
          <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && created && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">¡Prompt guardado!</h3>
            <p className="text-sm text-gray-500 mb-1">
              Guardado en tu catálogo personal en estado <span className="font-medium">en uso</span>.
            </p>
            <p className="text-xs text-gray-400 mb-6 font-mono">{created.slug}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                Añadir otro prompt
              </button>
              <Link
                href="/mis-prompts"
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Ver mis prompts
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 1: Input textarea ── */}
        {(step === 'idle' || step === 'analyzing') && (
          <>
            <div className="flex gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <InformationCircleIcon className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-700">
                Pega el prompt que ya usas en Cowork. El sistema generará los metadatos
                automáticamente y detectará si ya existe uno similar en el catálogo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Texto del prompt
              </label>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={10}
                placeholder="Pega aquí el prompt que usas en Cowork...&#10;&#10;Usa {{nombre_variable}} para marcar los valores que cambias en cada uso."
                disabled={step === 'analyzing'}
                className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl
                           shadow-sm text-gray-800 placeholder-gray-400 resize-none
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">
                {texto.length} caracteres
                {texto.includes('{{') && (
                  <span className="ml-2 text-indigo-500">
                    · Variables detectadas: {Array.from(texto.matchAll(/\{\{(\w+)\}\}/g), m => m[1]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={texto.trim().length < 10 || step === 'analyzing'}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white
                         text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === 'analyzing' ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                'Analizar prompt'
              )}
            </button>
          </>
        )}

        {/* ── Step 2: Review metadata ── */}
        {(step === 'review' || step === 'saving') && metadata && (
          <>
            {/* Near-duplicates warning */}
            {capture && capture.duplicados_candidatos.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  ⚠ Se encontraron prompts similares en el catálogo
                </p>
                <ul className="space-y-1">
                  {capture.duplicados_candidatos.map(d => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-amber-700">{d.titulo}</span>
                      <span className="text-xs text-amber-500">{Math.round(d.similitud * 100)}% similar</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-2">
                  Puedes seguir adelante si tu prompt es distinto, o descarta para reutilizar uno existente.
                </p>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Revisa y confirma los metadatos
              </p>

              {/* Título */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Título <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Nombre corto y descriptivo del prompt"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Propósito */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Propósito</label>
                <textarea
                  value={metadata.proposito}
                  onChange={e => setMetadata({ ...metadata, proposito: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg resize-none
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Variables detectadas */}
              {metadata.variables.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Variables detectadas <span className="text-green-500">✓ confirmar</span>
                  </label>
                  <div className="space-y-1.5">
                    {metadata.variables.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <code className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono">
                          {'{{'}{v.nombre}{'}}'}
                        </code>
                        <input
                          type="text"
                          value={v.descripcion}
                          onChange={e => {
                            const vars = [...metadata.variables]
                            vars[i] = { ...vars[i], descripcion: e.target.value }
                            setMetadata({ ...metadata, variables: vars })
                          }}
                          placeholder="Descripción de la variable"
                          className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded
                                     focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          <input
                            type="checkbox"
                            checked={v.obligatorio}
                            onChange={e => {
                              const vars = [...metadata.variables]
                              vars[i] = { ...vars[i], obligatorio: e.target.checked }
                              setMetadata({ ...metadata, variables: vars })
                            }}
                            className="accent-indigo-600"
                          />
                          Obligatoria
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Datos sensibles — CONFIRMAR */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">¿Contiene datos sensibles (PII)?</p>
                  <p className="text-xs text-gray-400">Confirmar — campo crítico para el gobierno</p>
                </div>
                <button
                  onClick={() => setMetadata({ ...metadata, datos_sensibles: !metadata.datos_sensibles })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${metadata.datos_sensibles ? 'bg-red-500' : 'bg-gray-200'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                      ${metadata.datos_sensibles ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              {/* Dominio + Tipo tarea */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dominio de negocio</label>
                  <div className="flex flex-wrap gap-1">
                    {metadata.dominio_negocio.map(d => (
                      <span key={d} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de tarea</label>
                  <div className="flex flex-wrap gap-1">
                    {metadata.tipo_tarea.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS_SUGERIDOS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors
                        ${metadata.tags.includes(tag)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-400'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Criticidad */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Criticidad</label>
                <select
                  value={metadata.criticidad}
                  onChange={e => setMetadata({ ...metadata, criticidad: e.target.value })}
                  className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={!titulo.trim() || step === 'saving'}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white
                           text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 'saving' ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar en mi catálogo'
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={step === 'saving'}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600
                           text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors
                           disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
