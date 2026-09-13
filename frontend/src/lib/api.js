export function fileUrl(storagePath) {
  if (!storagePath) return "";
  if (storagePath.startsWith("http")) return storagePath;
  
  const token = localStorage.getItem("rb_token") || localStorage.getItem("token") || accessToken || "";
  
  let cleanPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
  
  if (cleanPath.startsWith("api/files/")) {
    cleanPath = cleanPath.replace("api/files/", "");
  } else if (cleanPath.startsWith("files/")) {
    cleanPath = cleanPath.replace("files/", "");
  }

 return `\({API}/files/\){cleanPath}?auth=${token}`;
}