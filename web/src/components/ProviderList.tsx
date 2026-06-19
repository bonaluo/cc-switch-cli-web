import { useState, useEffect } from 'react'

export interface Provider {
  id: string
  name: string
  api_url: string
  active: boolean
  notes: string
}

interface ProviderListProps {
  providers: Provider[]
  loading: boolean
  onSwitch: (id: string) => void
  onRefresh: () => void
}

// Get icon based on provider name
function getProviderIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('nvidia')) return '🚀'
  if (lower.includes('deepseek')) return '🐋'
  if (lower.includes('modelscope')) return '🔭'
  if (lower.includes('minimax')) return '⚡'
  if (lower.includes('openai') || lower.includes('gpt')) return '🤖'
  if (lower.includes('claude')) return '🎭'
  if (lower.includes('gemini')) return '♊'
  if (lower.includes('anthropic')) return '🅰️'
  if (lower.includes('aws') || lower.includes('bedrock')) return '☁️'
  if (lower.includes('azure')) return '🔷'
  if (lower.includes('google')) return '🔍'
  if (lower.includes('alibaba') || lower.includes('qwen')) return '📦'
  if (lower.includes('baichuan')) return '🌊'
  if (lower.includes('moonshot') || lower.includes('kimi')) return '🌙'
  if (lower.includes('newapi')) return '🔌'
  if (lower.includes('中转')) return '🔄'
  return '🔐'
}

interface ProviderDetailData {
  provider: any
  health: any
  quota: any
  models: any
  model_fields: any[]
  meta_fields: any[]
}

interface SpeedtestOutput {
  output: string
}

interface QuotaOutput {
  data?: any
  output?: string
}

interface ModelsOutput {
  output: string
}

const CATEGORY_LABELS: Record<string, { title: string; icon: string }> = {
  name: { title: 'Name', icon: '🏷️' },
  notes: { title: 'Notes', icon: '📝' },
  base_url: { title: 'Base URL', icon: '🔗' },
  api_key: { title: 'API Key / Auth', icon: '🔑' },
  api_mode: { title: 'API Format', icon: '⚙️' },
  model: { title: 'Model', icon: '🤖' },
  other: { title: 'Other', icon: '📌' },
}

function groupFieldsByCategory(fields: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>()
  for (const f of fields) {
    const cat = f.category || 'other'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(f)
  }
  return groups
}

const CATEGORY_ORDER = ['name', 'notes', 'base_url', 'api_key', 'api_mode', 'model', 'other']

function ProviderList({ providers, loading, onSwitch, onRefresh }: ProviderListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [providerDetail, setProviderDetail] = useState<ProviderDetailData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [speedtestResult, setSpeedtestResult] = useState<SpeedtestOutput | null>(null)
  const [quotaResult, setQuotaResult] = useState<QuotaOutput | null>(null)
  const [modelsResult, setModelsResult] = useState<ModelsOutput | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [modelEdits, setModelEdits] = useState<Record<string, string>>({})
  const [savingModels, setSavingModels] = useState(false)

  // Build modelEdits from both meta_fields and model_fields when detail loads
  useEffect(() => {
    const edits: Record<string, string> = {}
    if (providerDetail?.meta_fields) {
      for (const f of providerDetail.meta_fields) {
        edits[f.label] = f.value
      }
    }
    if (providerDetail?.model_fields) {
      for (const f of providerDetail.model_fields) {
        edits[f.label] = f.value
      }
    }
    setModelEdits(edits)
  }, [providerDetail?.meta_fields, providerDetail?.model_fields])

  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.api_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.notes.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (a.active && !b.active) return -1
    if (!a.active && b.active) return 1
    return a.name.localeCompare(b.name)
  })

  const handleSwitch = async (id: string) => {
    setSwitchingId(id)
    await onSwitch(id)
    setSwitchingId(null)
  }

  const handleDetail = async (providerId: string) => {
    if (selectedProvider === providerId) {
      closeModal()
      return
    }
    setSelectedProvider(providerId)
    setSpeedtestResult(null)
    setQuotaResult(null)
    setModelsResult(null)
    setLoadingDetail(true)
    setActionFeedback(null)

    try {
      const res = await fetch(`/api/providers/${providerId}`)
      if (!res.ok) throw new Error('Failed to load detail')
      const data = await res.json()
      setProviderDetail(data)
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Failed to load provider detail')
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeModal = () => {
    setSelectedProvider(null)
    setProviderDetail(null)
    setSpeedtestResult(null)
    setQuotaResult(null)
    setModelsResult(null)
  }

  const handleDuplicate = async (providerId: string) => {
    setLoadingAction('duplicate')
    setActionFeedback(null)
    try {
      const res = await fetch(`/api/providers/${providerId}/duplicate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to duplicate')
      setActionFeedback(`✅ ${data.message}`)
      onRefresh()
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Duplicate failed')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSpeedtest = async (providerId: string) => {
    setLoadingAction('speedtest')
    setSpeedtestResult(null)
    try {
      const res = await fetch(`/api/providers/${providerId}/speedtest`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Speedtest failed')
      setSpeedtestResult(data)
    } catch (err) {
      setSpeedtestResult({ output: `Error: ${err instanceof Error ? err.message : 'Failed'}` })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleQuota = async (providerId: string) => {
    setLoadingAction('quota')
    setQuotaResult(null)
    try {
      const res = await fetch(`/api/providers/${providerId}/quota`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Quota query failed')
      setQuotaResult(data)
    } catch (err) {
      setQuotaResult({ output: `Error: ${err instanceof Error ? err.message : 'Failed'}` })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleFetchModels = async (providerId: string) => {
    setLoadingAction('models')
    setModelsResult(null)
    try {
      const res = await fetch(`/api/providers/${providerId}/fetch-models`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Fetch models failed')
      setModelsResult(data)
    } catch (err) {
      setModelsResult({ output: `Error: ${err instanceof Error ? err.message : 'Failed'}` })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSaveModels = async (providerId: string, apply: boolean) => {
    setSavingModels(true)
    setActionFeedback(null)
    try {
      const fields = Object.entries(modelEdits).map(([label, value]) => ({
        path: label.startsWith('_') ? [label] : label.split('.'),
        value
      }))
      const res = await fetch(`/api/providers/${providerId}/models`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, apply })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Save failed')
      setActionFeedback(apply ? '✅ Saved & Applied' : '✅ Saved')
      // Refresh detail to confirm
      const detailRes = await fetch(`/api/providers/${providerId}`)
      if (detailRes.ok) {
        const detailData = await detailRes.json()
        setProviderDetail(detailData)
      }
      if (apply) {
        onRefresh()
      }
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingModels(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500/30 border-t-indigo-500" />
        <span className="mt-6 text-slate-400 text-lg">Loading providers...</span>
      </div>
    )
  }

  const activeCount = providers.filter(p => p.active).length

  // Build all editable fields sorted: meta_fields first, then model_fields
  const allFields = [
    ...(providerDetail?.meta_fields || []),
    ...(providerDetail?.model_fields || []),
  ]
  const fieldGroups = groupFieldsByCategory(allFields)

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border-l-4 border-indigo-500">
          <div className="text-3xl font-bold text-white">{providers.length}</div>
          <div className="text-sm text-slate-400 mt-1">Total Providers</div>
        </div>
        <div className="glass rounded-xl p-4 border-l-4 border-emerald-500">
          <div className="text-3xl font-bold text-white">{activeCount}</div>
          <div className="text-sm text-slate-400 mt-1">Active</div>
        </div>
        <div className="glass rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-3xl font-bold text-white">{switchingId ? '...' : 'Ready'}</div>
          <div className="text-sm text-slate-400 mt-1">Status</div>
        </div>
        <div className="glass rounded-xl p-4 border-l-4 border-purple-500">
          <div className="text-3xl font-bold text-white">{filtered.length}</div>
          <div className="text-sm text-slate-400 mt-1">Filtered</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <input
            type="text"
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 w-72 transition-all"
          />
          <svg className="w-5 h-5 text-slate-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              const msg = 'Provider add/edit/delete require interactive TTY.\n\nTo add a provider, run in terminal:\n  cc-switch provider add\n\nOr use a template:\n  cc-switch provider add --template custom'
              setActionFeedback(msg)
            }}
            className="flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/25"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Provider
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center px-5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 hover:border-slate-600 transition-all"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582c1.075 0 2.075.54 2.657 1.44M20 20v-5h-.581c-1.076 0-2.076-.54-2.658-1.44" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {actionFeedback && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm whitespace-pre-wrap">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{actionFeedback}</span>
            <button onClick={() => setActionFeedback(null)} className="ml-auto text-slate-500 hover:text-slate-300 flex-shrink-0">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((provider, index) => (
          <div key={provider.id}>
            <div
              className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
                provider.active
                  ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
              }`}
              style={{ animation: `slideIn 0.4s ease-out ${index * 0.05}s both` }}
            >
              {provider.active && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              )}

              <div className="relative p-5">
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                      provider.active
                        ? 'bg-emerald-500/20'
                        : 'bg-slate-700/50 group-hover:bg-slate-700/70'
                    } transition-colors`}>
                      {getProviderIcon(provider.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate" title={provider.name}>
                        {provider.name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate" title={provider.api_url}>
                        {provider.api_url}
                      </p>
                      {provider.notes && (
                        <p className="mt-1 text-xs text-amber-300/90 truncate" title={provider.notes}>
                          📝 {provider.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {provider.active && (
                    <div className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                      Active
                    </div>
                  )}
                </div>

                {/* ID */}
                <div className="flex items-center mb-4">
                  <code className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">
                    {provider.id.slice(0, 8)}...
                  </code>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDetail(provider.id)}
                    className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-all bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:text-white hover:bg-slate-700/50"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Details
                  </button>

                  {provider.active ? (
                    <span className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Current
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSwitch(provider.id)}
                      disabled={switchingId === provider.id}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {switchingId === provider.id ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                          Switching...
                        </>
                      ) : (
                        'Candidate'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dialog for Provider Detail */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto glass rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/10">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-sm rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center text-lg">
                  {getProviderIcon(selectedProvider ? (providers.find(p => p.id === selectedProvider)?.name || '') : '')}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {providers.find(p => p.id === selectedProvider)?.name || 'Provider'}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">{selectedProvider}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-500/30 border-t-purple-500 mr-3" />
                  <span className="text-sm text-slate-400">Loading details...</span>
                </div>
              ) : (
                <>
                  {/* Health status */}
                  {providerDetail?.health && (
                    <div className="flex items-center space-x-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        providerDetail.health.is_healthy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {providerDetail.health.is_healthy ? '● Healthy' : '● Unhealthy'}
                      </span>
                      {providerDetail.health.consecutive_failures > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Failures: {providerDetail.health.consecutive_failures}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Editable Fields Form */}
                  {fieldGroups.size > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-700/30 space-y-4">
                      <h4 className="text-sm font-semibold text-indigo-300 flex items-center">
                        ⚙️ Settings
                      </h4>

                      {/* Render fields grouped by category in order */}
                      {CATEGORY_ORDER.map(cat => {
                        const groupFields = fieldGroups.get(cat)
                        if (!groupFields || groupFields.length === 0) return null
                        const catInfo = CATEGORY_LABELS[cat] || CATEGORY_LABELS.other
                        return (
                          <div key={cat} className="space-y-2">
                            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                              <span className="mr-1.5">{catInfo.icon}</span>
                              {catInfo.title}
                            </h5>
                            <div className="space-y-2 pl-1">
                              {groupFields.map((field: any) => {
                                const isSensitive =
                                  field.category === 'api_key' ||
                                  field.label.toLowerCase().includes('token') ||
                                  field.label.toLowerCase().includes('key')
                                const hasOptions = Array.isArray(field.options) && field.options.length > 0
                                return (
                                  <div key={field.label} className="flex flex-col gap-1">
                                    <label className="text-xs text-slate-500 font-mono">{field.label}</label>
                                    {isSensitive ? (
                                      <div className="relative">
                                        <input
                                          type="password"
                                          data-field={field.label}
                                          value={modelEdits[field.label] ?? field.value}
                                          onChange={(e) => setModelEdits(prev => ({ ...prev, [field.label]: e.target.value }))}
                                          disabled={savingModels}
                                          className="w-full pl-3 pr-10 py-2 rounded-md bg-slate-800/50 border border-slate-600/30 text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono"
                                        />
                                        <button
                                          type="button"
                                          onMouseDown={() => {
                                            const input = document.querySelector(`input[data-field="${field.label}"]`) as HTMLInputElement
                                            if (input) input.type = 'text'
                                          }}
                                          onMouseUp={() => {
                                            const input = document.querySelector(`input[data-field="${field.label}"]`) as HTMLInputElement
                                            if (input) input.type = 'password'
                                          }}
                                          onMouseLeave={() => {
                                            const input = document.querySelector(`input[data-field="${field.label}"]`) as HTMLInputElement
                                            if (input) input.type = 'password'
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                                          title="Hold to reveal"
                                        >
                                          👁
                                        </button>
                                      </div>
                                    ) : hasOptions ? (
                                      <div className="relative">
                                        <select
                                          value={modelEdits[field.label] ?? field.value}
                                          onChange={(e) => setModelEdits(prev => ({ ...prev, [field.label]: e.target.value }))}
                                          disabled={savingModels}
                                          className="w-full px-3 py-2 pr-8 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50 font-mono appearance-none cursor-pointer"
                                        >
                                          {field.options.map((opt: string) => (
                                            <option key={opt} value={opt} className="bg-slate-800 text-white">
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        data-field={field.label}
                                        value={modelEdits[field.label] ?? field.value}
                                        onChange={(e) => setModelEdits(prev => ({ ...prev, [field.label]: e.target.value }))}
                                        disabled={savingModels}
                                        className="w-full px-3 py-2 rounded-md bg-slate-800/50 border border-slate-600/30 text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-mono"
                                      />
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/30">
                        <button
                          onClick={() => handleSaveModels(selectedProvider!, false)}
                          disabled={savingModels}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                        >
                          {savingModels ? 'Saving...' : '💾 Save'}
                        </button>
                        <button
                          onClick={() => handleSaveModels(selectedProvider!, true)}
                          disabled={savingModels}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                        >
                          {savingModels ? 'Applying...' : '🚀 Save & Apply'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDuplicate(selectedProvider!)}
                      disabled={loadingAction === 'duplicate'}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                    >
                      {loadingAction === 'duplicate' ? 'Duplicating...' : '📋 Duplicate'}
                    </button>
                    <button
                      onClick={() => handleSpeedtest(selectedProvider!)}
                      disabled={loadingAction === 'speedtest'}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                    >
                      {loadingAction === 'speedtest' ? 'Testing...' : '⚡ Speedtest'}
                    </button>
                    <button
                      onClick={() => handleQuota(selectedProvider!)}
                      disabled={loadingAction === 'quota'}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                    >
                      {loadingAction === 'quota' ? 'Querying...' : '📊 Quota'}
                    </button>
                    <button
                      onClick={() => handleFetchModels(selectedProvider!)}
                      disabled={loadingAction === 'models'}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                    >
                      {loadingAction === 'models' ? 'Fetching...' : '🔍 Models'}
                    </button>
                  </div>

                  {/* Speedtest result */}
                  {speedtestResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <h4 className="text-xs font-semibold text-slate-300 mb-1 flex items-center">
                        ⚡ Speedtest Result
                        <button onClick={() => setSpeedtestResult(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
                      </h4>
                      <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {speedtestResult.output}
                      </pre>
                    </div>
                  )}

                  {/* Quota result */}
                  {quotaResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <h4 className="text-xs font-semibold text-slate-300 mb-1 flex items-center">
                        📊 Quota Result
                        <button onClick={() => setQuotaResult(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
                      </h4>
                      <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {quotaResult.data ? JSON.stringify(quotaResult.data, null, 2) : quotaResult.output}
                      </pre>
                    </div>
                  )}

                  {/* Models result */}
                  {modelsResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                      <h4 className="text-xs font-semibold text-slate-300 mb-1 flex items-center">
                        🔍 Available Models
                        <button onClick={() => setModelsResult(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs">✕</button>
                      </h4>
                      <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {modelsResult.output}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-slate-400 text-lg">No providers found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search or refresh the list</p>
        </div>
      )}
    </div>
  )
}

export default ProviderList