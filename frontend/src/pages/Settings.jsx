import { useState, useEffect } from 'react'
import { settingsApi } from '../services/api'

function Settings() {
  const [vendors, setVendors] = useState([])
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [vendorsData, statusesData] = await Promise.all([
        settingsApi.getVendors(),
        settingsApi.getStatuses()
      ])
      setVendors(vendorsData.vendors)
      setStatuses(statusesData.statuses)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVendorKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = e.target.value.trim()
      if (value && !vendors.includes(value)) {
        setVendors([...vendors, value])
      }
      e.target.value = ''
    }
  }

  const removeVendor = (index) => {
    setVendors(vendors.filter((_, i) => i !== index))
  }

  const handleStatusKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = e.target.value.trim()
      if (value && !statuses.includes(value)) {
        setStatuses([...statuses, value])
      }
      e.target.value = ''
    }
  }

  const removeStatus = (index) => {
    setStatuses(statuses.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await Promise.all([
        settingsApi.setVendors(vendors),
        settingsApi.setStatuses(statuses)
      ])
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const getWebhookUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/api/webhooks/order`
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(getWebhookUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={message.type === 'error' ? 'error' : ''} style={message.type === 'success' ? { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem' } : {}}>
          {message.text}
        </div>
      )}

      <div className="settings-section" style={{ background: '#eff6ff', borderColor: '#3b82f6' }}>
        <h2 className="settings-title" style={{ color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔗</span> n8n Webhook URL
        </h2>
        <p style={{ color: '#1e40af', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Copy this URL and add it to your n8n workflow's HTTP Request node. Send raw email data to automatically process orders.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
          <input
            type="text"
            readOnly
            value={getWebhookUrl()}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #3b82f6', fontFamily: 'monospace', fontSize: '0.875rem', background: 'white' }}
          />
          <button
            onClick={copyWebhook}
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', minWidth: '100px' }}
          >
            {copied ? '✓ Copied!' : 'Copy URL'}
          </button>
        </div>
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'white', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#1e293b' }}>Expected Request Format:</div>
          <pre style={{ margin: 0, overflow: 'auto', fontSize: '0.75rem', color: '#475569' }}>
{`{
  "subject": "Your Amazon order #123-456",
  "body": "Full email body text...",
  "snippet": "Short snippet...",
  "from": "order@amazon.com"
}`}
          </pre>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-title">Vendors</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Manage the list of vendors that can be assigned to orders. Press Enter or comma to add a new vendor.
        </p>
        <div className="tags-input">
          {vendors.map((vendor, index) => (
            <span key={index} className="tag">
              {vendor}
              <button className="tag-remove" onClick={() => removeVendor(index)}>×</button>
            </span>
          ))}
          <input
            type="text"
            className="tag-input"
            placeholder="Add vendor..."
            onKeyDown={handleVendorKeyDown}
          />
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-title">Order Statuses</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Define the possible statuses for orders. Press Enter or comma to add a new status.
        </p>
        <div className="tags-input">
          {statuses.map((status, index) => (
            <span key={index} className="tag">
              {status}
              <button className="tag-remove" onClick={() => removeStatus(index)}>×</button>
            </span>
          ))}
          <input
            type="text"
            className="tag-input"
            placeholder="Add status..."
            onKeyDown={handleStatusKeyDown}
          />
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-title">Environment Variables</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Configure these in your deployment environment or .env file.
        </p>
        <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '0.375rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          <div style={{ marginBottom: '0.5rem' }}><strong>Required:</strong></div>
          <div style={{ marginBottom: '1rem', color: 'var(--primary)' }}>GITHUB_TOKEN</div>
          <div style={{ marginBottom: '1rem' }}>Your GitHub token for AI inference</div>
          
          <div style={{ marginBottom: '0.5rem' }}><strong>Optional:</strong></div>
          <div style={{ marginBottom: '0.5rem' }}>AI_ENDPOINT (default: https://models.github.ai/inference)</div>
          <div>AI_MODEL (default: openai/gpt-5)</div>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-title">API Documentation</h2>
        <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
          <div style={{ marginBottom: '0.75rem' }}><strong>Base URL:</strong> {window.location.origin}/api</div>
          
          <div style={{ marginBottom: '0.5rem', marginTop: '1rem' }}><strong>Orders</strong></div>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.75' }}>
            <li>GET /orders - List all orders</li>
            <li>GET /orders/:id - Get order by ID</li>
            <li>POST /orders - Create new order</li>
            <li>PUT /orders/:id - Update order</li>
            <li>DELETE /orders/:id - Delete order</li>
            <li>GET /orders/search/:orderNumber - Search by order number</li>
          </ul>

          <div style={{ marginBottom: '0.5rem', marginTop: '1rem' }}><strong>Settings</strong></div>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.75' }}>
            <li>GET /settings - Get all settings</li>
            <li>GET /settings/vendors - Get vendor list</li>
            <li>PUT /settings/vendors - Update vendor list</li>
            <li>GET /settings/statuses - Get status list</li>
            <li>PUT /settings/statuses - Update status list</li>
          </ul>

          <div style={{ marginBottom: '0.5rem', marginTop: '1rem' }}><strong>Stats</strong></div>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.75' }}>
            <li>GET /stats - Get dashboard statistics</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Settings
