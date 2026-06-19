import { useState } from 'react'

export interface Provider {
  id: string
  name: string
  api_url: string
  active: boolean
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

  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.api_url.toLowerCase().includes(searchTerm.toLowerCase())
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
      setSelectedProvider(null)
      setProviderDetail(null)
      setSpeedtestResult(null)
      setQuotaResult(null)
      setModelsResult(null)
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500/30 border-t-indigo-500" />
        <span className="mt-6 text-slate-400 text-lg">Loading providers...</span>
      </div>
    )
  }

  const activeCount = providers.filter(p => p.active).length

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
          {/* Add provider button - shows CLI instructions since TTY is required */}
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
                  {/* Left: detail button */}
                  <button
                    onClick={() => handleDetail(provider.id)}
                    className={`inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedProvider === provider.id
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Details
                  </button>

                  {/* Right: switch button */}
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

            {/* Inline Detail Panel */}
            {selectedProvider === provider.id && (
              <div className="mt-2 glass rounded-xl border border-purple-500/20 p-4 space-y-3 animate-slide-in">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500/30 border-t-purple-500 mr-3" />
                    <span className="text-sm text-slate-400">Loading details...</span>
                  </div>
                ) : (
                  <>
                    {/* Provider metadata */}
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

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDuplicate(provider.id)}
                        disabled={loadingAction === 'duplicate'}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                      >
                        {loadingAction === 'duplicate' ? 'Duplicating...' : '📋 Duplicate'}
                      </button>
                      <button
                        onClick={() => handleSpeedtest(provider.id)}
                        disabled={loadingAction === 'speedtest'}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                      >
                        {loadingAction === 'speedtest' ? 'Testing...' : '⚡ Speedtest'}
                      </button>
                      <button
                        onClick={() => handleQuota(provider.id)}
                        disabled={loadingAction === 'quota'}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700/30 border border-slate-600/30 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
                      >
                        {loadingAction === 'quota' ? 'Querying...' : '📊 Quota'}
                      </button>
                      <button
                        onClick={() => handleFetchModels(provider.id)}
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
            )}
          </div>
        ))}
      </div>

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
