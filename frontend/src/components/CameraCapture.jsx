import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, VideoCamera, X, Circle, StopCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function CameraCapture({ onCapture, onClose }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [mode, setMode] = useState("photo"); // photo | video
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true, // تفعيل الصوت دائماً منذ البداية لضمان عمل الميكروفون مع الفيديو بدون تأخير
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setReady(true);
    } catch (e) {
      toast.error(t("cam.cameraError"));
      onClose();
    }
  };

  const stopStream = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch (e) { /* noop */ }
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    startStream();
    return stopStream;
    // eslint-disable-next-line
  }, []);

  const switchMode = async (m) => {
    if (recording) return;
    setMode(m);
    setReady(false);
    stopStream();
    setTimeout(startStream, 150);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      
      if (typeof onCapture === "function") {
        onCapture(file);
      }
      
      setCapturedCount((prev) => prev + 1);
      toast.success(`تم التقاط الصورة (${capturedCount + 1})، يمكنك التقاط غيرها أو الإغلاق`);
    }, "image/jpeg", 0.9);
  };

  const toggleRecording = () => {
    if (!recording) {
      chunksRef.current = [];
      
      // اختيار الصيغة المدعومة الأنسب لضمان استقرار الفيديو على السيرفر والمتصفحات
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4"
      ];
      let selectedMime = "";
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      
      try {
        const rec = new MediaRecorder(streamRef.current, options);
        
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        rec.onstop = () => {
          const blobType = selectedMime.includes("mp4") ? "video/mp4" : "video/webm";
          const ext = blobType.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(chunksRef.current, { type: blobType });
          const file = new File([blob], `video-${Date.now()}.${ext}`, { type: blobType });
          
          if (typeof onCapture === "function") {
            onCapture(file);
          }
          toast.success(t("cam.videoTaken"));
        };

        // تمرير timeslice بقيمة 1000ms يحل نهائياً مشكلة انقطاع الفيديو بعد ثوانٍ معدودة على السيرفر
        rec.start(1000);
        recorderRef.current = rec;
        setRecording(true);
        toast.info("بدء تسجيل الفيديو...");
      } catch (err) {
        console.error("MediaRecorder error:", err);
        toast.error("فشل بدء تسجيل الفيديو في هذا المتصفح");
      }
    } else {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
      setRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-accent" />
          <h3 className="font-head font-semibold text-sm">
            {t("cam.title")} {capturedCount > 0 && <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs ml-2">الصور الملتقطة: {capturedCount}</span>}
          </h3>
        </div>
        <button data-testid="camera-close" onClick={() => { stopStream(); onClose(); }} className="text-muted-foreground hover:text-primary-foreground flex items-center gap-1 bg-muted px-3 py-1 rounded-lg text-xs font-semibold">
          <X size={18} /> تم / إغلاق
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black relative">
        <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full" />
        {capturedCount > 0 && (
          <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs font-mono border border-white/20">
            تم التقاط: {capturedCount} صورة 📸
          </div>
        )}
        {recording && (
          <div className="absolute top-4 right-4 bg-red-600/90 text-white px-3 py-1.5 rounded-lg text-xs font-mono animate-pulse flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span> جاري تسجيل الفيديو...
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <button data-testid="camera-mode-photo" onClick={() => switchMode("photo")} disabled={recording}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider border rounded-lg transition-colors ${mode === "photo" ? "bg-primary text-primary-foreground border-white" : "border-border text-muted-foreground hover:text-primary-foreground"}`}>
            <Camera size={14} /> {t("cam.photo")}
          </button>
          <button data-testid="camera-mode-video" onClick={() => switchMode("video")} disabled={recording}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider border rounded-lg transition-colors ${mode === "video" ? "bg-primary text-primary-foreground border-white" : "border-border text-muted-foreground hover:text-primary-foreground"}`}>
            <VideoCamera size={14} /> {t("cam.video")}
          </button>
        </div>
        <div className="flex items-center justify-center">
          {mode === "photo" ? (
            <button data-testid="camera-shutter" onClick={takePhoto} disabled={!ready}
              className="flex items-center gap-2 bg-accent text-foreground font-head font-semibold text-sm uppercase tracking-wider px-8 py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40 shadow-lg">
              <Circle size={18} weight="fill" /> التقاط صورة أخرى
            </button>
          ) : (
            <button data-testid="camera-record" onClick={toggleRecording} disabled={!ready}
              className={`flex items-center gap-2 font-head font-semibold text-sm uppercase tracking-wider px-8 py-3 rounded-lg transition-colors disabled:opacity-40 ${recording ? "bg-red-600 text-foreground hover:bg-red-500" : "bg-accent text-foreground hover:bg-blue-500"}`}>
              {recording ? <><StopCircle size={18} weight="fill" /> {t("cam.stop")}</> : <><Circle size={18} weight="fill" /> {t("cam.startRecording")}</>}
            </button>
          )}
        </div>
        <p className="text-center text-[11px] font-mono text-muted-foreground mt-3">
          اضغط على زر الالتقاط عدة مرات كما تحب، وعند الانتهاء اضغط على زر "تم / إغلاق" في الأعلى.
        </p>
      </div>
    </div>
  );
}