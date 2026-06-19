import { useState, useEffect } from 'react'

interface EnvVar {
  [key: string]: string
}

function EnvTools() {
  const [activeSubTab, setActiveSubTab] = useState<'tools' | 'variables' | 'conflicts'>('tools')
  const [tools, setTools] = useState<EnvVar[]>([])
  const [variables, setVariables] = useState<EnvVar[]>([])
  const [conflicts, setConflicts] = useState<EnvVar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [toolsRes, varsRes, checkRes] = await Promise.all([
        fetch('/api/env/tools'),
        fetch('/api/env/variables'),
        fetch('/api/env/check'),
      ])
      const toolsData = await toolsRes.json()
      const varsData = await varsRes.json()
      const checkData = await checkRes.json()

      setTools(toolsData.tools || [])
      setVariables(varsData.variables || [])
      setConflicts(checkData.conflicts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch environment data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const subTabs = [
    { id: 'tools' as const, label: 'CLI Tools', icon: '🔧', count: tools.length },
    { id: 'variables' as const, label: 'Variables', icon: '📋', count: variables.length },
    { id: 'conflicts' as const, label: 'Conflicts', icon: '⚠️', count: conflicts.length, warn: conflicts.length > 0 },
  ]

  const TableView = ({ data, columns }: { data: EnvVar[], columns?: string[] }) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg">No data available</p>
        </div>
      )
    }

    const cols = columns || Object.keys(data[0])

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-700/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              {cols.map((col) => (
                <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700/30">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/20">
            {data.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-800/20 transition-colors"
              >
                {cols.map((col) => (
                  <td key={col} className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap max-w-[300px] truncate" title={row[col]}>
                    {row[col] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Special render for CLI Tools (simpler display)
  const ToolsView = ({ tools }: { tools: EnvVar[] }) => {
    if (!tools || tools.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-12 h-12 mb-3 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg">No CLI tools found</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool, idx) => {
          const toolName = tool['Tool'] || ''
          const status = tool['Status'] || ''
          const isOk = status.toLowerCase().includes('ok')
          const isError = status.toLowerCase().includes('error')
          const isNotInstalled = status.toLowerCase().includes('not installed')

          let statusColor = 'text-slate-400 border-slate-500/30 bg-slate-500/5'
          let icon = '❓'
          if (isOk) {
            statusColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
            icon = '✅'
          } else if (isError) {
            statusColor = 'text-red-400 border-red-500/30 bg-red-500/5'
            icon = '❌'
          } else if (isNotInstalled) {
            statusColor = 'text-amber-400 border-amber-500/30 bg-amber-500/5'
            icon = '⚠️'
          }

          return (
            <div
              key={idx}
              className={`glass rounded-xl p-4 border-l-4 ${statusColor} transition-all hover:bg-slate-800/40`}
              style={{ animation: `slideIn 0.3s ease-out ${idx * 0.05}s both` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{icon}</span>
                  <span className="font-semibold text-white">{toolName}</span>
                </div>
                <span className="text-xs font-medium text-slate-400 ml-3 truncate">{status}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex space-x-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800/50 w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 ${
              activeSubTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab.warn ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
        <button
          onClick={fetchAll}
          className="ml-2 px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582c1.075 0 2.075.54 2.657 1.44M20 20v-5h-.581c-1.076 0-2.076-.54-2.658-1.44" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500/30 border-t-indigo-500" />
          <span className="mt-4 text-slate-400">Loading environment data...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/20 text-red-300">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-sm underline hover:text-red-200">Dismiss</button>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {activeSubTab === 'tools' && <ToolsView tools={tools} />}
          {activeSubTab === 'variables' && <TableView data={variables} />}
          {activeSubTab === 'conflicts' && (
            <div>
              {conflicts.length > 0 ? (
                <div className="mb-4 p-4 rounded-xl bg-amber-900/20 border border-amber-500/20 text-amber-300 text-sm">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">⚠️</span>
                    Found {conflicts.length} environment variable(s) that may conflict with cc-switch management.
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/20 text-emerald-300 text-sm">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">✅</span>
                    No conflicting environment variables detected.
                  </div>
                </div>
              )}
              <TableView data={conflicts} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default EnvTools
