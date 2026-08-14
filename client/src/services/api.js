import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
});

function cookie(name) {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

export function apiErrorMessage(error) {
  const serverMessage = error.response?.data?.error?.message;
  if (serverMessage) return serverMessage;

  if (error.code === "ECONNABORTED") {
    return "The Nexora API did not respond. Confirm the backend is running.";
  }

  if (!error.response) {
    return "Unable to reach the Nexora API. Confirm the backend and MySQL are running.";
  }

  return error.message || "Request failed";
}

api.interceptors.request.use((config) => {
  if (config.method && !["get", "head", "options"].includes(config.method.toLowerCase())) {
    config.headers["X-CSRF-Token"] = decodeURIComponent(cookie("nexora_csrf"));
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(new Error(apiErrorMessage(error))),
);
