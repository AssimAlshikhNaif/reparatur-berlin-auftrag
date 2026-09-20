import axios from "axios";

// اجعل القيمة الافتراضية فارغة تماماً ليتم توجيه الطلبات عبر الـ Nginx العكسي بنجاح
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
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
  if (!storagePath) return "";
  if (storagePath.startsWith("http")) return storagePath;

  // تنظيف المسار تماماً
  let clean = storagePath.trim().replace(/^\/+/, "").replace(/^uploads\//, "");
  
  // إذا كان المسار يحتوي على orders مسبقاً
  if (clean.includes("orders")) {
    return `/uploads/${clean}`;
  }

  // إذا كان يبدأ بـ repair-berlin ولم تقترن بـ orders، نقوم بحقن orders فوراً
  if (clean.startsWith("repair-berlin/")) {
    clean = clean.replace("repair-berlin/", "repair-berlin/orders/");
  } else {
    clean = `repair-berlin/orders/${clean}`;
  }

  const finalUrl = `/uploads/${clean}`;
  console.log("Fixed Relative URL:", finalUrl); 
  return finalUrl;
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