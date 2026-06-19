import { useState, useEffect } from 'react'
import Header from './components/Header'
import ProviderList from './components/ProviderList'
import SessionList from './components/SessionList'
import EnvTools from './components/EnvTools'
import StatusBar from './components/StatusBar'

export interface Provider {
  id: string
  name: string
  api_url: string
  active: boolean
  notes: string
}

const tabs = [
  { id: 'providers' as const, label: 'Providers', icon: '🔌' },
  { id: 'sessions' as const, label: 'Sessions', icon: '💬' },
  { id: 'env' as const, label: 'Environment', icon: '🔧' },
]

function App() {
  const [activeTab, setActiveTab] = useState<'providers' | 'sessions' | 'env'>('providers')
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const fetchProviders = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/providers')
      if (!res.ok) throw new Error('Failed to fetch providers')
      const data = await res.json()
      setProviders(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()

    const ws = new WebSocket(`ws://${window.location.host}/ws`)
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'providers') {
        setProviders(msg.data)
      } else if (msg.type === 'switched') {
        fetchProviders()
      }
    }

    return () => ws.close()
  }, [])

  const handleSwitch = async (providerId: string) => {
    try {
      const res = await fetch(`/api/providers/${providerId}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to switch provider')
      await fetchProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed')
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Header wsConnected={wsConnected} />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Navigation Tabs */}
        <nav className="flex space-x-1 mb-8 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-500/20 text-red-300">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-sm underline hover:text-red-200 flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div>
          {activeTab === 'providers' && (
            <ProviderList
              providers={providers}
              loading={loading}
              onSwitch={handleSwitch}
              onRefresh={fetchProviders}
            />
          )}
          {activeTab === 'sessions' && <SessionList />}
          {activeTab === 'env' && <EnvTools />}
        </div>
      </main>

      <StatusBar providerCount={providers.length} activeProvider={providers.find(p => p.active)} />
    </div>
  )
}

export default App
