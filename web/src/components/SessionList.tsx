import { useState, useEffect } from 'react'

function SessionList() {
  const [isLoading, setIsLoading] = useState(true)
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = async (all: boolean = false) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/sessions?all=${all}`)
      const data = await res.json()
      setOutput(data.output || 'No sessions found')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Sessions</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchSessions(false)}
            className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all text-sm"
          >
            Current
          </button>
          <button
            onClick={() => fetchSessions(true)}
            className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all text-sm"
          >
            All
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          <span className="ml-4 text-slate-400">Loading sessions...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300">
          {error}
        </div>
      ) : (
        <div className="glass rounded-xl p-4 overflow-x-auto">
          <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}

export default SessionList
