"use client";

import { useEffect, useRef, useState } from "react";
import { IconQr, IconX } from "./Icons";

// "Scan QR": point the camera at a talk's code to join it. Browsers that can't
// read QR codes from the camera (BarcodeDetector is not everywhere) get a box to
// paste the join link or talk code instead, so this always works.

interface Detector { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> }
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** Pull a talk id out of a join link, a talk link or a bare code. */
export function parseJoinCode(text: string): string | null {
  const t = text.trim();
  const fromUrl = t.match(/\/(?:join|talk)\/([A-Za-z0-9_-]+)/)?.[1];
  if (fromUrl) return fromUrl;
  return /^[A-Za-z0-9_-]{2,80}$/.test(t) ? t : null;
}

export function QrScanner({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "unavailable">("starting");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const join = (raw: string) => {
    const id = parseJoinCode(raw);
    if (!id) return setError("That doesn't look like a Sidecar join code.");
    window.location.href = `/join/${id}`;
  };

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");

    let stream: MediaStream | undefined;
    let stopped = false;
    const detector = new Ctor({ formats: ["qr_code"] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const el = video.current;
        if (!el) return;
        el.srcObject = s;
        await el.play();
        setCamera("on");
        const scan = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(el);
            const id = found[0] && parseJoinCode(found[0].rawValue);
            if (id) return void (window.location.href = `/join/${id}`);
          } catch { /* a frame that can't be read is fine: try the next one */ }
          setTimeout(scan, 300);
        };
        scan();
      })
      .catch(() => setCamera("unavailable"));

    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="scan-title" onClick={onClose}>
      <div className="card w-full max-w-md animate-pop p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="scan-title" className="text-lg">Scan a talk&apos;s QR code</h2>
            <p className="mt-1 text-sm text-ink-soft">Every room shows one. Scanning picks that talk for you and opens it.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-ink-2">
          {camera === "unavailable" ? (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/70">
              <IconQr size={28} />
              <p>The camera isn&apos;t available here. Paste the join link or talk code below instead.</p>
            </div>
          ) : (
            <div className="relative aspect-[4/3]">
              <video ref={video} className="h-full w-full object-cover" muted playsInline aria-label="Camera view" />
              {camera === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Starting the camera…</p>}
              <span className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" aria-hidden="true" />
            </div>
          )}
        </div>

        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); join(code); }}>
          <label htmlFor="join-code" className="label">Join link or talk code</label>
          <div className="flex gap-2">
            <input id="join-code" className="input" placeholder="otel-at-scale" value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} />
            <button type="submit" className="btn btn-primary" disabled={!code.trim()}>Join</button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
        </form>
      </div>
    </div>
  );
}
