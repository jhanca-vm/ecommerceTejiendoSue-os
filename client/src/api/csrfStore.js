let csrfToken = null;

export function setCsrfToken(t) {
  csrfToken = t || null;
}

export function getCsrfToken() {
  return csrfToken;
}
