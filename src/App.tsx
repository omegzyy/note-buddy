import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import Login from './components/Login'
import Home from './components/Home'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <main className="center-screen">
        <div className="panel">
          <h1>Almost there</h1>
          <p>
            Copy <code>.env.example</code> to <code>.env</code>, fill in your Supabase URL and anon
            key, then restart <code>npm run dev</code>. The README has the full steps.
          </p>
        </div>
      </main>
    )
  }

  if (!ready) return <main className="center-screen muted">Loading…</main>
  if (!session) return <Login />
  return <Home key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} />
}
