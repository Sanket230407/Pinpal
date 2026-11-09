// A small wrapper around fetch, so every page talks to the server the same way.

// Carries the server's message, and the form field it belongs to when there is one.
export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

// Options:
//   method, body: the usual request details. The body is sent as JSON.
//   redirectOn401: set to false when a 401 is an expected answer. A wrong password on the
//   login page should show an error, not send the person back to the page they're on.
export async function api(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 401 && redirectOn401) {
    window.location.href = '/login.html';
    // Never finishes, so the page's code doesn't show an error while the browser navigates away.
    return new Promise(() => {});
  }

  // A proxy or crash could send back something other than JSON, so an empty object is the fallback.
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong. Try again.', response.status, data.field);
  }
  return data;
}
