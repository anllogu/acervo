const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Variable {
  nombre: string
  tipo: string
  obligatorio: boolean
  descripcion: string
}

export interface MetadataPropuesta {
  proposito: string
  tipo: string
  idioma: string
  variables: Variable[]
  formato_salida: string | null
  dominio_negocio: string[]
  tipo_tarea: string[]
  tags: string[]
  criticidad: string
  datos_sensibles: boolean
}

export interface DuplicadoCandidato {
  id: string
  slug: string
  titulo: string
  similitud: number
}

export interface CaptureResponse {
  metadata_propuesta: MetadataPropuesta
  duplicados_candidatos: DuplicadoCandidato[]
}

export interface PromptCreated {
  id: string
  slug: string
  titulo: string
  estado: string
  variante_cowork_id: string
}

export async function capturePrompt(texto: string, owner = 'angel.llosa'): Promise<CaptureResponse> {
  const res = await fetch(`${API_URL}/prompts/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, owner }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Capture error ${res.status}: ${detail}`)
  }
  return res.json()
}

export async function createPrompt(payload: {
  texto: string
  titulo: string
  metadata: MetadataPropuesta
  owner?: string
  visibilidad?: string
}): Promise<PromptCreated> {
  const res = await fetch(`${API_URL}/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: 'angel.llosa', visibilidad: 'personal', ...payload }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Create error ${res.status}: ${detail}`)
  }
  return res.json()
}

// ── Phase 2: Search ──────────────────────────────────────────────────────────

export interface SearchCandidate {
  id: string
  slug: string
  titulo: string
  proposito: string
  dominio_negocio: string[]
  tipo_tarea: string[]
  tags: string[]
  destacado: boolean
  criticidad: string
  datos_sensibles: boolean
  variables_count: number
  rrf_score: number
}

export interface SearchResponse {
  query: string
  total: number
  candidates: SearchCandidate[]
}

export interface FacetsResponse {
  dominio_negocio: string[]
  tipo_tarea: string[]
}

export async function searchPrompts(payload: {
  query: string
  dominio_negocio?: string[]
  tipo_tarea?: string[]
  limit?: number
}): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dominio_negocio: [], tipo_tarea: [], limit: 10, ...payload }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Search error ${res.status}: ${detail}`)
  }
  return res.json()
}

export async function getFacets(): Promise<FacetsResponse> {
  const res = await fetch(`${API_URL}/facets`)
  if (!res.ok) throw new Error(`Facets error ${res.status}`)
  return res.json()
}

// ── Phase 3: Recommend + Detail ──────────────────────────────────────────────

export interface IntentParsed {
  dominio_negocio: string[]
  tipo_tarea: string[]
  restricciones: string[]
  consulta_expandida: string
}

export interface RecommendCandidate extends SearchCandidate {
  cuando_usarlo: string
}

export interface RecommendResponse {
  descripcion: string
  intent: IntentParsed
  total: number
  candidates: RecommendCandidate[]
}

export interface VarianteCowork {
  id: string
  cuerpo_adaptado: string
}

export interface PromptDetail {
  id: string
  slug: string
  titulo: string
  proposito: string
  cuerpo_canonico: string
  variables: Variable[]
  dominio_negocio: string[]
  tipo_tarea: string[]
  tags: string[]
  destacado: boolean
  criticidad: string
  datos_sensibles: boolean
  estado: string
  variante_cowork: VarianteCowork | null
}

export async function recommendPrompts(payload: {
  descripcion: string
  limit?: number
}): Promise<RecommendResponse> {
  const res = await fetch(`${API_URL}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 10, ...payload }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Recommend error ${res.status}: ${detail}`)
  }
  return res.json()
}

export async function getPromptDetail(id: string): Promise<PromptDetail> {
  const res = await fetch(`${API_URL}/prompts/${id}`)
  if (!res.ok) throw new Error(`Prompt detail error ${res.status}`)
  return res.json()
}

// ── Discover ─────────────────────────────────────────────────────────────────

export interface DiscoverResponse {
  prompts: SearchCandidate[]
  total: number
}

export async function discoverPrompts(
  dominio_negocio: string[] = [],
  tipo_tarea: string[] = [],
): Promise<DiscoverResponse> {
  const params = new URLSearchParams()
  dominio_negocio.forEach(d => params.append('dominio_negocio', d))
  tipo_tarea.forEach(t => params.append('tipo_tarea', t))
  const res = await fetch(`${API_URL}/discover?${params.toString()}`)
  if (!res.ok) throw new Error(`Discover error ${res.status}`)
  return res.json()
}

// ── Phase 4: Variable fill ───────────────────────────────────────────────────

export interface FillQuestion {
  nombre: string
  pregunta: string
  descripcion: string
  obligatorio: boolean
}

export interface FillQuestionsResponse {
  prompt_id: string
  titulo: string
  questions: FillQuestion[]
}

export interface FillResponse {
  prompt_id: string
  titulo: string
  prompt_relleno: string
}

export async function getFillQuestions(id: string): Promise<FillQuestionsResponse> {
  const res = await fetch(`${API_URL}/prompts/${id}/fill`)
  if (!res.ok) throw new Error(`Fill questions error ${res.status}`)
  return res.json()
}

export async function fillPrompt(id: string, respuestas: Record<string, string>, usuario = 'angel.llosa'): Promise<FillResponse> {
  const res = await fetch(`${API_URL}/prompts/${id}/fill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuestas, usuario }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Fill error ${res.status}: ${detail}`)
  }
  return res.json()
}

export async function logUso(id: string, usuario = 'angel.llosa'): Promise<void> {
  await fetch(`${API_URL}/prompts/${id}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario }),
  })
}

export async function ratePrompt(id: string, senal: -1 | 1, usuario = 'angel.llosa'): Promise<void> {
  await fetch(`${API_URL}/prompts/${id}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senal, usuario }),
  })
}

// ── Phase 6: Mis prompts + Stats ─────────────────────────────────────────────

export interface MyPromptSummary {
  id: string
  slug: string
  titulo: string
  proposito: string
  estado: string
  criticidad: string
  datos_sensibles: boolean
  destacado: boolean
  variables_count: number
  creado_en: string
}

export interface MyPromptsResponse {
  owner: string
  total: number
  prompts: MyPromptSummary[]
}

export interface StatsResponse {
  total_prompts: number
  total_usos: number
  total_valoraciones_positivas: number
  total_valoraciones_negativas: number
  prompts_this_week: number
  usos_this_week: number
}

export async function getMyPrompts(owner = 'angel.llosa'): Promise<MyPromptsResponse> {
  const res = await fetch(`${API_URL}/prompts?owner=${encodeURIComponent(owner)}`)
  if (!res.ok) throw new Error(`My prompts error ${res.status}`)
  return res.json()
}

export async function getStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_URL}/stats`)
  if (!res.ok) throw new Error(`Stats error ${res.status}`)
  return res.json()
}

// ── Phase 7: Agent search ────────────────────────────────────────────────────

export interface AgentQuestion {
  text: string
  context: string
}

export interface AgentReasoningStep {
  step: number
  action: string
  detail: string
}

export interface AgentSearchResponse {
  session_id: string
  status: 'waiting' | 'done'
  question?: AgentQuestion
  intent?: IntentParsed
  candidates?: RecommendCandidate[]
  reasoning: AgentReasoningStep[]
}

export async function agentSearch(payload: {
  query: string
  session_id?: string | null
  user_response?: string | null
}): Promise<AgentSearchResponse> {
  const res = await fetch(`${API_URL}/agent/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Agent search error ${res.status}: ${detail}`)
  }
  return res.json()
}
