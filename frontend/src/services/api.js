const API_BASE = '/api';

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const ordersApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/orders${query ? `?${query}` : ''}`);
  },

  getById: (id) => fetchAPI(`/orders/${id}`),

  create: (order) => fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),

  update: (id, order) => fetchAPI(`/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(order),
  }),

  delete: (id) => fetchAPI(`/orders/${id}`, {
    method: 'DELETE',
  }),

  search: (orderNumber) => fetchAPI(`/orders/search/${orderNumber}`),
};

export const settingsApi = {
  getAll: () => fetchAPI('/settings'),

  get: (key) => fetchAPI(`/settings/${key}`),

  set: (key, value) => fetchAPI(`/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  }),

  getVendors: () => fetchAPI('/settings/vendors'),

  setVendors: (vendors) => fetchAPI('/settings/vendors', {
    method: 'PUT',
    body: JSON.stringify({ vendors }),
  }),

  getStatuses: () => fetchAPI('/settings/statuses'),

  setStatuses: (statuses) => fetchAPI('/settings/statuses', {
    method: 'PUT',
    body: JSON.stringify({ statuses }),
  }),
};

export const statsApi = {
  get: () => fetchAPI('/stats'),
};
