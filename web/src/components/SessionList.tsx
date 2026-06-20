import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { copyToClipboard } from '../utils/clipboard'

interface Session {
  providerId: string
  sessionId: string
  title: string
  summary: string
  projectDir: string
  createdAt: number
  lastActiveAt: number
  sourcePath: string
  resumeCommand: string
}

// Convert snake_case to camelCase for session data from cc-switch JSON output
function normalizeSession(raw: any): Session {
  return {
    providerId: raw.provider_id || raw.providerId || '',
    sessionId: raw.session_id || raw.sessionId || '',
    title: raw.title || '',
    summary: raw.summary || '',
    projectDir: raw.project_dir || raw.projectDir || '',
    createdAt: raw.created_at || raw.createdAt || 0,
    lastActiveAt: raw.last_active_at || raw.lastActiveAt || 0,
    sourcePath: raw.source_path || raw.sourcePath || '',
    resumeCommand: raw.resume_command || raw.resumeCommand || '',
  }
}

interface SessionDetail {
  session: Session
  messages: Message[]
}

interface Message {
  role: string
  content: string
  ts: number
}

function SessionList() {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedMsgId, setCopiedMsgId] = useState<number | null>(null)

  const handleCopyMessage = async (text: string, idx: number) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedMsgId(idx)
      setTimeout(() => setCopiedMsgId(null), 2000)
    }
  }

  const fetchSessions = async (all: boolean = false) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions?all=${all}`)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      const sessionsList = (data.sessions || []).map(normalizeSession)
      setSessions(sessionsList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (!urlSessionId) {
      setSelectedSession(null)
      return
    }
    fetch(`/api/sessions/${urlSessionId}`)
      .then(res => {
        if (!res.ok) throw new Error('Session not found')
        return res.json()
      })
      .then(data => setSelectedSession(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load session detail'))
  }, [urlSessionId])

  const handleBackToList = () => {
    navigate('/sessions')
  }

  const formatDate = (ts: number) => {
    if (!ts) return 'N/A'
    return new Date(ts).toLocaleString()
  }

  const formatRelative = (ts: number) => {
    if (!ts) return ''
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user': return '👤'
      case 'assistant': return '🤖'
      case 'tool': return '🔧'
      case 'system': return '⚙️'
      default: return '❓'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user': return 'border-blue-500/50 bg-blue-500/5'
      case 'assistant': return 'border-emerald-500/50 bg-emerald-500/5'
      case 'tool': return 'border-amber-500/50 bg-amber-500/5'
      case 'system': return 'border-purple-500/50 bg-purple-500/5'
      default: return 'border-slate-500/50 bg-slate-500/5'
    }
  }

  const filtered = sessions.filter(s =>
    s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.providerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.projectDir?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Session Detail View
  if (urlSessionId && selectedSession) {
    const s = selectedSession.session
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={handleBackToList}
          className="flex items-center text-sm text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to sessions
        </button>

        {/* Session header card */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{s.title || 'Untitled'}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center px-2 py-1 rounded-md bg-slate-700/30">
                  <code className="text-indigo-300">{s.sessionId?.slice(0, 12)}...</code>
                </span>
                <span className="flex items-center px-2 py-1 rounded-md bg-slate-700/30">
                  📁 {s.projectDir || 'N/A'}
                </span>
                <span className="flex items-center px-2 py-1 rounded-md bg-slate-700/30">
                  {formatRelative(s.lastActiveAt)}
                </span>
              </div>
            </div>
          </div>

          {s.summary && (
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{s.summary}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <code className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded select-all">
              {s.resumeCommand}
            </code>
            <button
              onClick={() => copyToClipboard(s.resumeCommand)}
              className="text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
            >
              Copy resume command
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Messages ({selectedSession.messages?.length || 0})
          </h3>
          {selectedSession.messages?.length > 0 ? (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {selectedSession.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 border-l-4 ${getRoleColor(msg.role)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-300 flex items-center">
                      {getRoleIcon(msg.role)}
                      <span className="ml-1 capitalize">{msg.role}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 hover:text-slate-200 transition-colors"
                        title="Copy message"
                      >
                        {copiedMsgId === idx ? (
                          <>
                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 012-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <span className="text-xs text-slate-500">{formatDate(msg.ts)}</span>
                    </div>
                  </div>
                  <pre className="text-sm text-slate-400 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                    {msg.content?.slice(0, 2000)}
                    {(msg.content?.length || 0) > 2000 && '...'}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              No messages in this session
            </div>
          )}
        </div>
      </div>
    )
  }

  // Session list view
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 border-l-4 border-indigo-500">
          <div className="text-3xl font-bold text-white">{sessions.length}</div>
          <div className="text-sm text-slate-400 mt-1">Total Sessions</div>
        </div>
        <div className="glass rounded-xl p-4 border-l-4 border-emerald-500">
          <div className="text-3xl font-bold text-white">{filtered.length}</div>
          <div className="text-sm text-slate-400 mt-1">Visible</div>
        </div>
        <div className="glass rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-sm font-bold text-white">
            {sessions.length > 0 ? new Date(sessions[0].lastActiveAt).toLocaleDateString() : 'N/A'}
          </div>
          <div className="text-sm text-slate-400 mt-1">Most Recent</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
          />
          <svg className="w-5 h-5 text-slate-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => { setShowAll(false); fetchSessions(false) }}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              !showAll
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => { setShowAll(true); fetchSessions(true) }}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              showAll
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => fetchSessions(showAll)}
            className="px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582c1.075 0 2.075.54 2.657 1.44M20 20v-5h-.581c-1.076 0-2.076-.54-2.658-1.44" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500/30 border-t-indigo-500" />
          <span className="mt-4 text-slate-400">Loading sessions...</span>
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

      {/* Session cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((session, index) => (
            <div
              key={session.sessionId}
              className="glass rounded-xl p-5 border border-slate-700/30 hover:border-indigo-500/30 hover:bg-slate-800/40 transition-all cursor-pointer group"
              style={{ animation: `slideIn 0.3s ease-out ${index * 0.04}s both` }}
              onClick={() => navigate(`/sessions/${session.sessionId}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                    {session.title || 'Untitled'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 font-mono">
                      {session.providerId}
                    </span>
                    <span className="text-xs text-slate-500" title={session.projectDir}>
                      {session.projectDir?.split('/').pop() || session.projectDir}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-500 ml-3 flex-shrink-0" title={formatDate(session.lastActiveAt)}>
                  {formatRelative(session.lastActiveAt)}
                </span>
              </div>

              {session.summary && (
                <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap break-words">
                  {session.summary}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/20">
                <code className="text-xs text-slate-500 font-mono truncate max-w-[80%]">
                  {session.sessionId?.slice(0, 12)}...
                </code>
                <div className="flex items-center text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View messages
                  <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-slate-400 text-lg">No sessions found</p>
          <p className="text-slate-500 text-sm mt-1">
            {searchTerm ? 'Try adjusting your search' : 'No saved sessions available'}
          </p>
        </div>
      )}
    </div>
  )
}

export default SessionList
