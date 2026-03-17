function getAuthToken() {
  return localStorage.getItem("cooptrackToken");
}

function authHeaders(extra = {}) {
  const token = getAuthToken();

  const headers = {
    ...extra
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}