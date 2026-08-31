import axios from "axios";

// إذا لم يتم تحديد REACT_APP_BACKEND_URL أثناء البناء (build)، نستخدم مسارًا نسبيًا "/api".
// هذا يجعل الواجهة الأمامية تعمل تلقائياً عبر بروكسي Nginx (انظر nginx.conf) بغض النظر
// عن الدومين أو IP السيرفر، بدلاً من ربطها بعنوان IP ثابت قد يتغيّر عند إعادة النشر.
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

let accessToken = localStorage.getItem("rb_token") || localStorage.getItem("token") || null;

export function setToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem("rb_token", token);
    localStorage.setItem("token", token); // حفظه بالطريقتين لضمان التوافق
  } else {
    localStorage.removeItem("rb_token");
    localStorage.removeItem("token");
  }
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
  
  // جلب التوكن من أي مفتاح محتمل لضمان عدم فشله أبداً
  const token = localStorage.getItem("rb_token") || localStorage.getItem("token") || accessToken || "";
  
  // تنظيف مسار الملف لضمان عدم تكرار الشرطة المائلة
  const cleanPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
  
  return `${API}/files/${cleanPath}?auth=${token}`;
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