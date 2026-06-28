'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationCircleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  HandThumbUpIcon as ThumbUpSolid,
  HandThumbDownIcon as ThumbDownSolid,
  StarIcon as StarSolid,
} from '@heroicons/react/24/solid'
import {
  getPromptDetail,
  getFillQuestions,
  fillPrompt,
  logUso,
  ratePrompt,
  type PromptDetail,
  type FillQuestion,
} from '@/lib/api'

const CRITICIDAD_COLOR: Record<string, string> = {
  baja: 'bg-green-50 text-green-700',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-red-50 text-red-700',
}

type FillStep = 'idle' | 'loading-questions' | 'questions' | 'filling' | 'result'

export default function PromptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<PromptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Rating state
  const [rating, setRating] = useState<-1 | 1 | null>(null)

  // Fill modal state
  const [fillStep, setFillStep] = useState<FillStep>('idle')
  const [fillQuestions, setFillQuestions] = useState<FillQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [fillError, setFillError] = useState<string | null>(null)
  const [filledText, setFilledText] = useState<string | null>(null)
  const [copiedFilled, setCopiedFilled] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getPromptDetail(id)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleRate(senal: -1 | 1) {
    setRating(senal)
    await ratePrompt(id, senal)
  }

  async function handleCopy() {
    if (!detail?.variante_cowork) return
    await navigator.clipboard.writeText(detail.variante_cowork.cuerpo_adaptado)
    await logUso(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleOpenFill() {
    setFillStep('loading-questions')
    setFillError(null)
    setFilledText(null)
    setAnswers({})
    try {
      const res = await getFillQuestions(id)
      setFillQuestions(res.questions)
      const initial: Record<string, string> = {}
      res.questions.forEach(q => { initial[q.nombre] = '' })
      setAnswers(initial)
      setFillStep('questions')
    } catch (e) {
      setFillError(e instanceof Error ? e.message : 'Error al obtener preguntas')
      setFillStep('idle')
    }
  }

  async function handleFillSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFillStep('filling')
    setFillError(null)
    try {
      const res = await fillPrompt(id, answers)
      setFilledText(res.prompt_relleno)
      setFillStep('result')
    } catch (e) {
      setFillError(e instanceof Error ? e.message : 'Error al rellenar')
      setFillStep('questions')
    }
  }

  async function handleCopyFilled() {
    if (!filledText) return
    await navigator.clipboard.writeText(filledText)
    setCopiedFilled(true)
    setTimeout(() => setCopiedFilled(false), 2000)
  }

  function handleCloseFill() {
    setFillStep('idle')
    setFillError(null)
    setFilledText(null)
    setAnswers({})
  }

  const isModalOpen = fillStep !== 'idle'

  useEffect(() => {
    if (!isModalOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseFill() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isModalOpen])

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-lg w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="max-w-2xl">
        <div className="flex gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error ?? 'Prompt no encontrado'}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Volver
        </button>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={detail.titulo}
        action={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Volver
          </button>
        }
      />

      <div className="max-w-2xl space-y-5">
        {/* ── Meta card ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {detail.destacado && <StarSolid className="w-4 h-4 text-amber-400 shrink-0" />}
              <span
                className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${CRITICIDAD_COLOR[detail.criticidad] ?? 'bg-gray-50 text-gray-500'}`}
              >
                {detail.criticidad}
              </span>
              {detail.datos_sensibles && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-500 border border-red-100">PII</span>
              )}
            </div>
            <span className="text-xs text-gray-400">{detail.estado}</span>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">{detail.proposito}</p>

          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {detail.dominio_negocio.map(d => (
              <span key={d} className="text-xs text-blue-500">{d}</span>
            ))}
            {detail.tipo_tarea.map(t => (
              <span key={t} className="text-xs text-purple-500">{t}</span>
            ))}
          </div>

          {detail.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {detail.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full border border-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Rating ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">¿Te ha sido útil este prompt?</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleRate(1)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                rating === 1
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
              }`}
            >
              {rating === 1
                ? <ThumbUpSolid className="w-3.5 h-3.5" />
                : <HandThumbUpIcon className="w-3.5 h-3.5" />}
              Sí
            </button>
            <button
              onClick={() => handleRate(-1)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                rating === -1
                  ? 'bg-red-50 border-red-200 text-red-500'
                  : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
              }`}
            >
              {rating === -1
                ? <ThumbDownSolid className="w-3.5 h-3.5" />
                : <HandThumbDownIcon className="w-3.5 h-3.5" />}
              No
            </button>
          </div>
        </div>

        {/* ── Cowork variant ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Prompt — variante Cowork</h2>
            <div className="flex gap-2">
              {detail.variables.length > 0 && (
                <button
                  onClick={handleOpenFill}
                  className="px-3 py-1.5 text-xs rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  Rellenar variables
                </button>
              )}
              {detail.variante_cowork && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                      Copiar prompt
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {detail.variante_cowork ? (
            <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100 max-h-96 overflow-y-auto">
              {detail.variante_cowork.cuerpo_adaptado}
            </pre>
          ) : (
            <p className="text-xs text-gray-400 italic">No hay variante Cowork disponible.</p>
          )}

          {detail.variables.length > 0 && (
            <div className="pt-2 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-2">Variables ({detail.variables.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.variables.map(v => (
                  <span
                    key={v.nombre}
                    className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100"
                    title={v.descripcion}
                  >
                    {`{{${v.nombre}}}`}
                    {v.obligatorio && <span className="ml-0.5 text-indigo-400">*</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fill modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseFill} />
          <div
            ref={modalRef}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Rellenar variables</h3>
              <button
                onClick={handleCloseFill}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {fillStep === 'loading-questions' && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-9 bg-gray-100 rounded-lg" />
                  <div className="h-4 bg-gray-100 rounded w-2/3 mt-4" />
                  <div className="h-9 bg-gray-100 rounded-lg" />
                </div>
              )}

              {fillError && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
                  <ExclamationCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{fillError}</p>
                </div>
              )}

              {fillStep === 'questions' && (
                <form onSubmit={handleFillSubmit} className="space-y-4">
                  {fillQuestions.map(q => (
                    <div key={q.nombre}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {q.pregunta}
                        {q.obligatorio && <span className="ml-0.5 text-indigo-400">*</span>}
                      </label>
                      {q.descripcion && (
                        <p className="text-xs text-gray-400 mb-1">{q.descripcion}</p>
                      )}
                      <input
                        type="text"
                        required={q.obligatorio}
                        value={answers[q.nombre] ?? ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.nombre]: e.target.value }))}
                        placeholder={`{{${q.nombre}}}`}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseFill}
                      className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      Generar prompt
                    </button>
                  </div>
                </form>
              )}

              {fillStep === 'filling' && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-gray-500">Generando prompt...</span>
                </div>
              )}

              {fillStep === 'result' && filledText && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Prompt listo para copiar en Cowork:</p>
                  <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100 max-h-72 overflow-y-auto">
                    {filledText}
                  </pre>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCloseFill}
                      className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={handleCopyFilled}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      {copiedFilled ? (
                        <>
                          <CheckIcon className="w-3.5 h-3.5" />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                          Copiar prompt
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
