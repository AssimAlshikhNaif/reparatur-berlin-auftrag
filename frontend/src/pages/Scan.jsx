import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { QrCode, Keyboard, Camera, StopCircle } from "@phosphor-icons/react";

export default function Scan() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const busyRef = useRef(false);

  const lookup = async (auftragsnummer) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { data } = await api.get(`/orders/lookup/${encodeURIComponent(auftragsnummer.trim())}`);
      toast.success(t("scan.found", { nr: data.auftragsnummer }));
      await stop();
      navigate(`/auftrag/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("scan.notFound"));
      busyRef.current = false;
    }
  };

  const start = async () => {
    setScanning(true);
    try {
      const html5 = new Html5Qrcode("qr-reader");
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { lookup(decodedText); },
        () => {}
      );
    } catch (err) {
      toast.error(t("scan.cameraError"));
      setScanning(false);
    }
  };

  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) { /* noop */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { if (scannerRef.current) { try { scannerRef.current.stop(); } catch (e) {} } }, []);

  return (
    <div>
      <PageHeader label={t("scan.label")} title={t("scan.title")} />
      <div className="p-6 md:p-8 max-w-xl space-y-6">
        {/* Scanner */}
        <div className="border border-border">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60">
            <QrCode size={16} className="text-accent" />
            <h2 className="font-head font-semibold text-sm">{t("scan.cameraScanner")}</h2>
          </div>
          <div className="p-4">
            <div id="qr-reader" className="w-full overflow-hidden bg-black min-h-[80px]" />
            {!scanning ? (
              <button data-testid="start-scan" onClick={start}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider py-3 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
                <Camera size={16} /> {t("scan.startScanner")}
              </button>
            ) : (
              <button data-testid="stop-scan" onClick={stop}
                className="mt-4 w-full flex items-center justify-center gap-2 border border-border text-foreground/80 font-head font-semibold text-sm uppercase tracking-wider py-3 rounded-lg hover:bg-muted transition-colors">
                <StopCircle size={16} /> {t("scan.stop")}
              </button>
            )}
          </div>
        </div>

        {/* Manual */}
        <div className="border border-border">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60">
            <Keyboard size={16} className="text-accent" />
            <h2 className="font-head font-semibold text-sm">{t("scan.manualEntry")}</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) lookup(manual); }} className="p-4 flex gap-2">
            <input data-testid="manual-auftragsnummer" value={manual} onChange={(e) => setManual(e.target.value)}
              placeholder="RB-2026-00001"
              className="flex-1 bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent transition-colors font-mono" />
            <button data-testid="manual-lookup" type="submit"
              className="bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider px-6 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
              {t("scan.search")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
