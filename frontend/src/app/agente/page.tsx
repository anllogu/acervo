'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  CpuChipIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  PaperAirplaneIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import {
  agentSearch,
  type AgentSearchResponse,
  type AgentReasoningStep,
  type RecommendCandidate,
  type IntentParsed,
} from '@/lib/api'

type AgentState = 'idle' | 'searching' | 'waiting_for_answer' | 'done' | 'error'

interface ConversationEntry {
  type: 'user_query' | 'question' | 'result'
  text?: string
  response?: AgentSearchResponse
}

const CRITICIDAD_COLOR: Record<string, string> = {
  baja: 'bg-green-50 text-green-700',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-red-50 text-red-700',
}

export default function AgentePage() {
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [query, setQuery] = useState('')
  const [originalQuery, setOriginalQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const queryRef = useRef<HTMLTextAreaElement>(null)
  const answerRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || agentState === 'searching') return
    setOriginalQuery(q)
    setQuery('')
    setConversation([{ type: 'user_query', text: q }])
    setAgentState('searching')
    setError(null)
    setSessionId(null)
    try {
      const res = await agentSearch({ query: q })
      setSessionId(res.session_id)
      if (res.status === 'waiting') {
        setConversation(prev => [...prev, { type: 'question', response: res }])
        setAgentState('waiting_for_answer')
        setTimeout(() => answerRef.current?.focus(), 50)
      } else {
        setConversation(prev => [...prev, { type: 'result', response: res }])
        setAgentState('done')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el agente')
      setAgentState('error')
    }
  }

  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault()
    const a = answer.trim()
    if (!a || !sessionId || agentState === 'searching') return
    setAnswer('')
    setConversation(prev => [...prev, { type: 'user_query', text: a }])
    setAgentState('searching')
    setError(null)
    try {
      const res = await agentSearch({ query: originalQuery, session_id: sessionId, user_response: a })
      setSessionId(res.session_id)
      if (res.status === 'waiting') {
        setConversation(prev => [...prev, { type: 'question', response: res }])
        setAgentState('waiting_for_answer')
        setTimeout(() => answerRef.current?.focus(), 50)
      } else {
        setConversation(prev => [...prev, { type: 'result', response: res }])
        setAgentState('done')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el agente')
      setAgentState('error')
    }
  }

  function handleReset() {
    setAgentState('idle')
    setQuery('')
    setAnswer('')
    setSessionId(null)
    setOriginalQuery('')
    setConversation([])
    setError(null)
    setTimeout(() => queryRef.current?.focus(), 50)
  }

  return (
    <>
      <PageHeader
        title="Agente"
        subtitle="Búsqueda inteligente y conversacional de prompts"
      />

      <div className="max-w-2xl space-y-6">
        {/* ── Idle: hero input ── */}
        {agentState === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                ref={queryRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder="Describe lo que necesitas hacer... El agente buscará y te preguntará si necesita más contexto."
                rows={3}
                className="w-full px-4 py-3.5 text-sm bg-white border border-gray-200 rounded-xl
                           shadow-sm text-gray-800 placeholder-gray-400 resize-none
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Intro para enviar · Shift+Intro para nueva línea</p>
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm
                           rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                Buscar
              </button>
            </div>
          </form>
        )}

        {/* ── Conversation thread ── */}
        {conversation.length > 0 && (
          <div className="space-y-4">
            {conversation.map((entry, i) => {
              if (entry.type === 'user_query') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-md bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5">
                      {entry.text}
                    </div>
                  </div>
                )
              }

              if (entry.type === 'question' && entry.response?.question) {
                return (
                  <div key={i} className="flex gap-3">
                    <AgentAvatar />
                    <div className="flex-1 bg-white rounded-xl border border-indigo-100 shadow-sm p-4 space-y-3">
                      <p className="text-sm text-gray-700">{entry.response.question.text}</p>
                      <p className="text-xs text-gray-400">{entry.response.question.context}</p>
                      {agentState === 'waiting_for_answer' && i === conversation.length - 1 && (
                        <form onSubmit={handleAnswer} className="flex gap-2 pt-1">
                          <input
                            ref={answerRef}
                            value={answer}
                            onChange={e => setAnswer(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={!answer.trim()}
                            className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg
                                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            Responder
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )
              }

              if (entry.type === 'result' && entry.response) {
                return (
                  <div key={i} className="flex gap-3">
                    <AgentAvatar />
                    <div className="flex-1 space-y-4">
                      <ResultsBlock response={entry.response} />
                    </div>
                  </div>
                )
              }

              return null
            })}

            {/* ── Agent thinking spinner ── */}
            {agentState === 'searching' && (
              <div className="flex items-center gap-3">
                <AgentAvatar spinning />
                <span className="text-sm text-gray-400">Analizando...</span>
              </div>
            )}

            {/* ── Error state ── */}
            {agentState === 'error' && error && (
              <div className="flex gap-3">
                <AgentAvatar />
                <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Nueva búsqueda button ── */}
        {(agentState === 'done' || agentState === 'error') && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />
            Nueva búsqueda
          </button>
        )}
      </div>
    </>
  )
}

function AgentAvatar({ spinning = false }: { spinning?: boolean }) {
  return (
    <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
      {spinning
        ? <ArrowPathIcon className="w-4 h-4 text-indigo-500 animate-spin" />
        : <CpuChipIcon className="w-4 h-4 text-indigo-500" />
      }
    </div>
  )
}

function ReasoningCollapsible({ steps }: { steps: AgentReasoningStep[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ChevronDownIcon className={`w-3 h-3 transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
        Razonamiento ({steps.length} paso{steps.length !== 1 ? 's' : ''})
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-5 border-l-2 border-gray-100">
          {steps.map(step => (
            <div key={step.step} className="flex gap-2 text-xs text-gray-500">
              <span className="text-gray-300 font-mono w-4 shrink-0">{step.step}.</span>
              <span className="font-medium text-gray-500 capitalize shrink-0">{step.action}:</span>
              <span className="text-gray-400">{step.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IntentChips({ intent }: { intent: IntentParsed }) {
  if (!intent.dominio_negocio.length && !intent.tipo_tarea.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-400 font-medium shrink-0">Entendido como:</span>
      {intent.dominio_negocio.map(d => (
        <span key={d} className="px-2.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 border border-blue-100">
          {d}
        </span>
      ))}
      {intent.tipo_tarea.map(t => (
        <span key={t} className="px-2.5 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 border border-purple-100">
          {t}
        </span>
      ))}
    </div>
  )
}

function ResultsBlock({ response }: { response: AgentSearchResponse }) {
  const candidates = response.candidates ?? []
  return (
    <div className="space-y-3">
      <ReasoningCollapsible steps={response.reasoning} />
      {response.intent && <IntentChips intent={response.intent} />}
      <p className="text-xs text-gray-400">
        {candidates.length} resultado{candidates.length !== 1 ? 's' : ''}
      </p>
      {candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <CpuChipIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-400">No encontré prompts para esta búsqueda</p>
          <p className="text-xs text-gray-300 mt-1">Prueba con una descripción distinta</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => <ResultCard key={c.id} candidate={c} />)}
        </div>
      )}
    </div>
  )
}

function ResultCard({ candidate: c }: { candidate: RecommendCandidate }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3 hover:border-indigo-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {c.destacado && <StarSolid className="w-4 h-4 text-amber-400 shrink-0" />}
          <h3 className="text-sm font-semibold text-gray-900 truncate">{c.titulo}</h3>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${CRITICIDAD_COLOR[c.criticidad] ?? 'bg-gray-50 text-gray-500'}`}>
          {c.criticidad}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{c.proposito}</p>
      {c.cuando_usarlo && (
        <p className="text-xs text-indigo-500 italic leading-relaxed">{c.cuando_usarlo}</p>
      )}
      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 5).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full border border-gray-100">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {c.dominio_negocio.map(d => <span key={d} className="text-xs text-blue-500">{d}</span>)}
          {c.tipo_tarea.map(t => <span key={t} className="text-xs text-purple-500">{t}</span>)}
          {c.variables_count > 0 && (
            <span className="text-xs text-gray-400">{c.variables_count} variable{c.variables_count !== 1 ? 's' : ''}</span>
          )}
          {c.datos_sensibles && <span className="text-xs text-red-400">PII</span>}
        </div>
        <Link
          href={`/prompts/${c.id}`}
          className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700 shrink-0"
        >
          Usar <ChevronRightIcon className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
