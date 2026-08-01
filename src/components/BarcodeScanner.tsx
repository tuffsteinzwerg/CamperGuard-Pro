import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);

  // Callback immer aktuell halten, OHNE den Kamera-Effekt neu zu starten
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    let controls: any = null;
    let done = false;

    reader
      .decodeFromVideoDevice(undefined, video, (result: any) => {
        if (result && !done) {
          done = true;
          try { if (controls) controls.stop(); } catch { /* egal */ }
          onDetectedRef.current(result.getText());
        }
      })
      .then((c: any) => {
        controls = c;
        if (done && controls) { try { controls.stop(); } catch { /* egal */ } }
      })
      .catch(() => {
        setError('Kamera nicht verfügbar. Bitte Kamerazugriff erlauben oder den Code von Hand eingeben.');
      });

    return () => {
      done = true;
      try { if (controls) controls.stop(); } catch { /* egal */ }
    };
  }, []); // nur EINMAL starten -> kein Flackern durch Neustarts

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="typo-section-title text-white">Barcode scannen</span>
          <button onClick={onClose} className="cg-master-button !p-2"><X size={16} /></button>
        </div>
        {error ? (
          <div className="typo-body text-[var(--status-danger)] text-center py-8">{error}</div>
        ) : (
          <>
            <video ref={videoRef} className="w-full rounded-lg bg-black aspect-square object-cover" playsInline muted />
            <div className="typo-body-dim text-center mt-3">Halte den Barcode ruhig ins Bild.</div>
          </>
        )}
        <button onClick={onClose} className="cg-master-button w-full !p-3 mt-4">Abbrechen</button>
      </div>
    </div>
  );
}
