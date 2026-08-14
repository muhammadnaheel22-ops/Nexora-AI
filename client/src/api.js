export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");

function cookie(name) {
  return document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
export async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers };
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers["X-CSRF-Token"] = decodeURIComponent(cookie("nexora_csrf"));
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, method, headers, credentials: "include" });
  } catch {
    throw new Error("Unable to reach the Nexora API. Confirm the backend and PostgreSQL are available.");
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Request failed (${response.status})`);
  return data;
}
