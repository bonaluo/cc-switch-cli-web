interface HeaderProps {
  wsConnected: boolean
}

function Header({ wsConnected }: HeaderProps) {
  return (
    <header className="glass border-b border-indigo-500/20 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 leading-tight">
                CC Switch Web
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Provider Management</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* WebSocket Status */}
            <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              wsConnected
                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-950/50 text-amber-400 border border-amber-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {wsConnected ? 'Live' : 'Offline'}
            </div>

            {/* Version badge */}
            <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-700/50">
              v1.0.0
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
