import { useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('Idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const testBackend = async () => {
    setStatus('Loading...')
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/health')
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      const data = await response.json()
      setResult(data)
      setStatus('Success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('Failed')
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <h1>Cognify Frontend</h1>
      <p>Use the button below to test the backend health endpoint.</p>

      <button onClick={testBackend}>Test Backend</button>

      <div style={{ marginTop: '1rem' }}>
        <p>
          <strong>Status:</strong> {status}
        </p>
        {result && (
          <pre style={{ padding: '0.75rem', borderRadius: 8 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
        {error && (
          <p style={{ color: '#b00020' }}>
            <strong>Error:</strong> {error}
          </p>
        )}
      </div>
    </main>
  )
}

export default App
