import { useState, useEffect } from 'react'
import { settingsApi } from '../services/api'

function Settings() {
  const [vendors, setVendors] = useState([])
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

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
        <h2 className="settings-title">n8n Integration</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          n8n handles only the email trigger. The backend handles AI classification, extraction, and database operations.
        </p>
        <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '0.375rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          <div style={{ marginBottom: '0.5rem' }}><strong>Webhook Endpoint:</strong></div>
          <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>POST http://your-server:3000/api/webhooks/order</div>
          
          <div style={{ marginBottom: '0.5rem' }}><strong>Request Body:</strong></div>
          <pre style={{ background: 'var(--surface)', padding: '0.75rem', borderRadius: '0.25rem', overflow: 'auto' }}>
{`{
  "subject": "Your Amazon order #408-0237654-1573974",
  "body": "Full email body text...",
  "snippet": "Short snippet...",
  "from": "order-update@amazon.com"
}`}
          </pre>
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
          <div style={{ marginBottom: '0.75rem' }}><strong>Base URL:</strong> http://localhost:3000/api</div>
          
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

          <div style={{ marginBottom: '0.5rem', marginTop: '1rem' }}><strong>Webhooks</strong></div>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.75' }}>
            <li>POST /webhooks/order - Process email (n8n integration)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Settings
