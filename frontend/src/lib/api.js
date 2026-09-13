import axios from "axios";

// القيمة الافتراضية هنا 8001 لتطابق ملف الـ .env لديك
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

let accessToken = localStorage.getItem("rb_token") || null;

export function setToken(token) {
  accessToken = token;
  if (token) localStorage.setItem("rb_token", token);
  else localStorage.removeItem("rb_token");
}

export function getToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export function fileUrl(storagePath) {
  return `${API}/files/${storagePath}?auth=${accessToken}`;
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Ein Fehler ist aufgetreten. Bitte erneut versuchen.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;