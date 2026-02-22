import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ordersApi, settingsApi } from '../services/api'

function OrderDetails() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [vendors, setVendors] = useState([])
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(null)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    try {
      const [orderData, vendorsData, statusesData] = await Promise.all([
        ordersApi.getById(id),
        settingsApi.getVendors(),
        settingsApi.getStatuses()
      ])
      setOrder(orderData)
      setFormData({
        ...orderData,
        items: orderData.items.length > 0 
          ? orderData.items 
          : [{ item_name: '', quantity: 1, price: '', currency: 'AED' }]
      })
      setVendors(vendorsData.vendors)
      setStatuses(statusesData.statuses)
    } catch (error) {
      console.error('Failed to load order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const orderData = {
        ...formData,
        items: formData.items.filter(item => item.item_name.trim())
      }
      await ordersApi.update(id, orderData)
      setEditing(false)
      loadOrder()
    } catch (error) {
      alert(error.message)
    }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_name: '', quantity: 1, price: '', currency: 'AED' }]
    }))
  }

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const getStatusClass = (status) => {
    const statusMap = {
      'Ordered': 'status-ordered',
      'Shipped': 'status-shipped',
      'Out for Delivery': 'status-out-for-delivery',
      'Delivered': 'status-delivered'
    }
    return statusMap[status] || 'status-ordered'
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!order) {
    return <div className="error">Order not found</div>
  }

  return (
    <div>
      <Link to="/" className="back-link">← Back to Dashboard</Link>

      <div className="page-header">
        <h1 className="page-title">Order Details</h1>
        <div>
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ marginRight: '0.5rem' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save Changes
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              Edit Order
            </button>
          )}
        </div>
      </div>

      <div className="order-detail-header">
        <div className="order-detail-grid">
          <div>
            <div className="order-detail-label">Order Number</div>
            {editing ? (
              <input
                type="text"
                className="form-input"
                value={formData.order_number}
                onChange={e => setFormData(prev => ({ ...prev, order_number: e.target.value }))}
              />
            ) : (
              <div className="order-detail-value">{order.order_number}</div>
            )}
          </div>
          <div>
            <div className="order-detail-label">Vendor</div>
            {editing ? (
              <select
                className="form-select"
                value={formData.vendor}
                onChange={e => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
              >
                {vendors.map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            ) : (
              <div className="order-detail-value">{order.vendor}</div>
            )}
          </div>
          <div>
            <div className="order-detail-label">Status</div>
            {editing ? (
              <select
                className="form-select"
                value={formData.status}
                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            ) : (
              <span className={`status-badge ${getStatusClass(order.status)}`}>
                {order.status}
              </span>
            )}
          </div>
          <div>
            <div className="order-detail-label">Customer</div>
            {editing ? (
              <input
                type="text"
                className="form-input"
                value={formData.customer_name}
                onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            ) : (
              <div className="order-detail-value">{order.customer_name || '-'}</div>
            )}
          </div>
          <div>
            <div className="order-detail-label">Location</div>
            {editing ? (
              <input
                type="text"
                className="form-input"
                value={formData.location}
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            ) : (
              <div className="order-detail-value">{order.location || '-'}</div>
            )}
          </div>
          <div>
            <div className="order-detail-label">Expected Date</div>
            {editing ? (
              <input
                type="text"
                className="form-input"
                value={formData.expected_date}
                onChange={e => setFormData(prev => ({ ...prev, expected_date: e.target.value }))}
              />
            ) : (
              <div className="order-detail-value">{order.expected_date || '-'}</div>
            )}
          </div>
        </div>

        {editing && (
          <div style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
        )}

        {!editing && order.notes && (
          <div style={{ marginTop: '1rem' }}>
            <div className="order-detail-label">Notes</div>
            <div className="order-detail-value">{order.notes}</div>
          </div>
        )}
      </div>

      <div className="items-list">
        <div className="items-header">
          Order Items ({order.items?.length || 0})
        </div>
        
        {editing ? (
          <div style={{ padding: '1rem' }}>
            {formData.items.map((item, index) => (
              <div key={index} className="item-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Item name"
                  value={item.item_name}
                  onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                />
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '80px' }}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                />
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100px' }}
                  placeholder="Price"
                  value={item.price}
                  onChange={e => handleItemChange(index, 'price', e.target.value)}
                />
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeItem(index)}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addItem}>
              + Add Item
            </button>
          </div>
        ) : order.items?.length > 0 ? (
          order.items.map((item, index) => (
            <div key={index} className="item-card">
              <div className="item-info">
                <div className="item-name">{item.item_name}</div>
                <div className="item-details">
                  Qty: {item.quantity} {item.currency && `• ${item.currency}`}
                </div>
              </div>
              <div className="item-price">
                {item.price ? `${item.currency || 'AED'} ${item.price}` : '-'}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No items in this order</div>
        )}
      </div>

      <div style={{ marginTop: '1rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
        Created: {new Date(order.created_at).toLocaleString()} 
        {order.updated_at && ` • Updated: ${new Date(order.updated_at).toLocaleString()}`}
      </div>
    </div>
  )
}

export default OrderDetails
