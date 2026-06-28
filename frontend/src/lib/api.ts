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
