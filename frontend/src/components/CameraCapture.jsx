import { useEffect, useRef, useState } from "react";
import { Camera, VideoCamera, X, Circle, StopCircle, ArrowClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [mode, setMode] = useState("photo"); // photo | video
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: mode === "video",
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setReady(true);
    } catch (e) {
      toast.error("Kamera konnte nicht gestartet werden. Bitte Berechtigung prüfen.");
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

  // restart stream when switching mode (audio requirement differs)
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
      onCapture(file);
      toast.success("Foto aufgenommen");
    }, "image/jpeg", 0.9);
  };

  const toggleRecording = () => {
    if (!recording) {
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
      const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], `video-${Date.now()}.webm`, { type: "video/webm" });
        onCapture(file);
        toast.success("Video aufgenommen");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } else {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-accent" />
          <h3 className="font-head font-semibold text-sm">Live-Aufnahme · Zustandsprotokoll</h3>
        </div>
        <button data-testid="camera-close" onClick={() => { stopStream(); onClose(); }} className="text-muted-foreground hover:text-primary-foreground">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full" />
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <button data-testid="camera-mode-photo" onClick={() => switchMode("photo")} disabled={recording}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider border rounded-lg transition-colors ${mode === "photo" ? "bg-primary text-primary-foreground border-white" : "border-border text-muted-foreground hover:text-primary-foreground"}`}>
            <Camera size={14} /> Foto
          </button>
          <button data-testid="camera-mode-video" onClick={() => switchMode("video")} disabled={recording}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider border rounded-lg transition-colors ${mode === "video" ? "bg-primary text-primary-foreground border-white" : "border-border text-muted-foreground hover:text-primary-foreground"}`}>
            <VideoCamera size={14} /> Video
          </button>
        </div>
        <div className="flex items-center justify-center">
          {mode === "photo" ? (
            <button data-testid="camera-shutter" onClick={takePhoto} disabled={!ready}
              className="flex items-center gap-2 bg-accent text-foreground font-head font-semibold text-sm uppercase tracking-wider px-8 py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40">
              <Circle size={18} weight="fill" /> Aufnehmen
            </button>
          ) : (
            <button data-testid="camera-record" onClick={toggleRecording} disabled={!ready}
              className={`flex items-center gap-2 font-head font-semibold text-sm uppercase tracking-wider px-8 py-3 rounded-lg transition-colors disabled:opacity-40 ${recording ? "bg-red-600 text-foreground hover:bg-red-500" : "bg-accent text-foreground hover:bg-blue-500"}`}>
              {recording ? <><StopCircle size={18} weight="fill" /> Stopp</> : <><Circle size={18} weight="fill" /> Aufnahme starten</>}
            </button>
          )}
        </div>
        <p className="text-center text-[11px] font-mono text-muted-foreground mt-3">
          Aufnahmen werden direkt dem Auftrag hinzugefügt. Sie können mehrere Aufnahmen machen.
        </p>
      </div>
    </div>
  );
}
