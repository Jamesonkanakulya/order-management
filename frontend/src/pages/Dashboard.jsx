import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ordersApi, settingsApi, statsApi } from '../services/api'

function Dashboard() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [vendors, setVendors] = useState([])
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    vendor: ''
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ordersData, statsData, vendorsData, statusesData] = await Promise.all([
        ordersApi.getAll({ ...filters, limit: 100 }),
        statsApi.get(),
        settingsApi.getVendors(),
        settingsApi.getStatuses()
      ])
      setOrders(ordersData.orders)
      setTotal(ordersData.total)
      setStats(statsData)
      setVendors(vendorsData.vendors)
      setStatuses(statusesData.statuses)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setFilters(prev => ({ ...prev, search: e.target.value }))
  }

  const handleStatusFilter = (e) => {
    setFilters(prev => ({ ...prev, status: e.target.value }))
  }

  const handleVendorFilter = (e) => {
    setFilters(prev => ({ ...prev, vendor: e.target.value }))
  }

  const openCreateModal = () => {
    setEditingOrder(null)
    setShowModal(true)
  }

  const openEditModal = (order) => {
    setEditingOrder(order)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this order?')) return
    try {
      await ordersApi.delete(id)
      loadData()
    } catch (error) {
      alert(error.message)
    }
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Order
        </button>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{stats.totalOrders}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Delivery</div>
            <div className="stat-value">{stats.pendingDelivery}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Delivered This Month</div>
            <div className="stat-value">{stats.deliveredThisMonth}</div>
          </div>
        </div>
      )}

      <div className="filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search by order number or customer..."
          value={filters.search}
          onChange={handleSearch}
        />
        <select
          className="filter-select"
          value={filters.status}
          onChange={handleStatusFilter}
        >
          <option value="">All Statuses</option>
          {statuses.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.vendor}
          onChange={handleVendorFilter}
        >
          <option value="">All Vendors</option>
          {vendors.map(vendor => (
            <option key={vendor} value={vendor}>{vendor}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders found. Create your first order!</p>
        </div>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Vendor</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Location</th>
              <th>Expected Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>
                  <Link to={`/order/${order.id}`} className="order-link">
                    {order.order_number}
                  </Link>
                </td>
                <td>{order.vendor}</td>
                <td>{order.customer_name}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td>{order.location}</td>
                <td>{order.expected_date}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => openEditModal(order)}
                    style={{ marginRight: '0.5rem' }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(order.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <OrderModal
          order={editingOrder}
          vendors={vendors}
          statuses={statuses}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

function OrderModal({ order, vendors, statuses, onClose, onSave }) {
  const [formData, setFormData] = useState({
    order_number: order?.order_number || '',
    vendor: order?.vendor || vendors[0] || '',
    customer_name: order?.customer_name || '',
    status: order?.status || statuses[0] || 'Ordered',
    location: order?.location || '',
    expected_date: order?.expected_date || '',
    notes: order?.notes || '',
    items: order?.items || [{ item_name: '', quantity: 1, price: '', currency: 'AED' }]
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const orderData = {
        ...formData,
        items: formData.items.filter(item => item.item_name.trim())
      }

      if (order) {
        await ordersApi.update(order.id, orderData)
      } else {
        await ordersApi.create(orderData)
      }
      onSave()
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{order ? 'Edit Order' : 'Create Order'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Order Number</label>
            <input
              type="text"
              className="form-input"
              value={formData.order_number}
              onChange={e => setFormData(prev => ({ ...prev, order_number: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Vendor</label>
            <select
              className="form-select"
              value={formData.vendor}
              onChange={e => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
            >
              {vendors.map(vendor => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.customer_name}
              onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={formData.status}
              onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
            >
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
              type="text"
              className            <input
="form-input"
              value={formData.location}
              onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expected Date</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., 2025-10-15 or Wednesday"
              value={formData.expected_date}
              onChange={e => setFormData(prev => ({ ...prev, expected_date: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="items-section">
            <label className="form-label">Items</label>
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

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {order ? 'Update' : 'Create'} Order
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Dashboard
