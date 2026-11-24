async function parse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
  return body
}

export function createApi(base = '/weread-reader/api') {
  const request = (path, init) => fetch(`${base}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  }).then(parse)

  return {
    status: () => request('/status'),
    startQr: () => request('/auth/qr/start', { method: 'POST', body: '{}' }),
    waitQr: body => request('/auth/qr/wait', { method: 'POST', body: JSON.stringify(body) }),
    refreshAuth: () => request('/auth/refresh', { method: 'POST', body: '{}' }),
    logout: () => request('/auth/logout', { method: 'POST', body: '{}' }),
    prefs: body => request('/prefs', { method: 'POST', body: JSON.stringify(body) }),
    shelf: ({ patient = false } = {}) => request(`/shelf${patient ? '?patient=1' : ''}`),
    chapters: bookId => request(`/chapters?bookId=${encodeURIComponent(bookId)}`),
    chapter: (bookId, chapterUid) => request(`/chapter?bookId=${encodeURIComponent(bookId)}&chapterUid=${encodeURIComponent(chapterUid)}`),
    exportChapters: body => request('/chapters/export', { method: 'POST', body: JSON.stringify(body) }),
    focus: body => request('/reading/focus', { method: 'POST', body: JSON.stringify(body) }),
    blur: body => request('/reading/blur', { method: 'POST', body: JSON.stringify(body) }),
    heartbeat: body => request('/reading/heartbeat', { method: 'POST', body: JSON.stringify(body) }),
  }
}
