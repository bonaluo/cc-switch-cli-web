import { Provider } from '../App'

interface StatusBarProps {
  providerCount: number
  activeProvider?: Provider
}

function StatusBar({ providerCount, activeProvider }: StatusBarProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 glass border-t border-indigo-500/20 z-50">
      <div className="container mx-auto px-4 py-2 max-w-6xl">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">
              Total Providers: <span className="text-white font-medium">{providerCount}</span>
            </span>
            {activeProvider && (
              <span className="text-slate-400">
                Active: <span className="text-emerald-400 font-medium">{activeProvider.name}</span>
              </span>
            )}
          </div>
          <div className="text-slate-500">
            CC Switch Web v1.0.0
          </div>
        </div>
      </div>
    </footer>
  )
}

export default StatusBar
