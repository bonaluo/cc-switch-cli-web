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
  return '🔐'
}

function ProviderList({ providers, loading, onSwitch, onRefresh }: ProviderListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.api_url.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sort: active first, then alphabetically
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

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((provider, index) => (
          <div
            key={provider.id}
            className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
              provider.active
                ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
            }`}
            style={{ animation: `slideIn 0.4s ease-out ${index * 0.05}s both` }}
          >
            {/* Active glow effect */}
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

              {/* Action button */}
              <div className="flex justify-end">
                {provider.active ? (
                  <span className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => handleSwitch(provider.id)}
                    disabled={switchingId === provider.id}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchingId === provider.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Switching...
                      </>
                    ) : (
                      <>
                        Candidate
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
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
