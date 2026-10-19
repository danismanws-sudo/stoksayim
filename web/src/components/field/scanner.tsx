"use client";

import { Flashlight, FlashlightOff, Keyboard, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FORMATS = [
  "qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93",
  "codabar", "itf", "data_matrix", "pdf417", "aztec",
] as const;

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}

/** Android Chrome'da yerel BarcodeDetector, diğerlerinde (iPhone) ZXing-WASM. */
async function createDetector(): Promise<Detector> {
  const g = globalThis as unknown as {
    BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };
  };
  if (g.BarcodeDetector) {
    try {
      const supported = await g.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.includes("ean_13") && formats.includes("code_128")) {
        return new g.BarcodeDetector({ formats });
      }
    } catch {
      /* ponyfill'e düş */
    }
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: [...FORMATS] }) as unknown as Detector;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 1320;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    o.connect(gain).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.13);
    setTimeout(() => ctx.close(), 300);
  } catch {
    /* ses yoksa sorun değil */
  }
}

export function Scanner({
  active,
  onDetected,
  onManual,
}: {
  active: boolean;
  onDetected: (code: string) => void;
  onManual: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const cbRef = useRef(onDetected);
  cbRef.current = onDetected;

  const [status, setStatus] = useState<"starting" | "ready" | "denied" | "error">("starting");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorchOn(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    let cancelled = false;
    let raf = 0;
    let busy = false;
    let lastTick = 0;

    (async () => {
      setStatus("starting");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
        setTorchAvailable(Boolean(caps.torch));
        if (caps.focusMode?.includes("continuous")) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        }

        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        detectorRef.current ??= await createDetector();
        if (cancelled) return;
        setStatus("ready");

        const loop = async (t: number) => {
          raf = requestAnimationFrame(loop);
          if (busy || t - lastTick < 120 || v.readyState < 2) return;
          lastTick = t;
          busy = true;
          try {
            const res = await detectorRef.current!.detect(v);
            const code = res[0]?.rawValue?.trim();
            if (code) {
              const now = Date.now();
              // aynı barkodun art arda tetiklenmesini engelle
              if (code !== lastRef.current.code || now - lastRef.current.at > 2500) {
                lastRef.current = { code, at: now };
                navigator.vibrate?.(60);
                beep();
                cbRef.current(code);
              }
            }
          } catch {
            /* kare atlanır */
          } finally {
            busy = false;
          }
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        const name = (e as DOMException)?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stop();
    };
  }, [active, stop]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {/* karartma + çerçeve */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative aspect-[1.45] w-[78%] max-w-md rounded-3xl shadow-[0_0_0_200vmax_rgb(0_0_0/0.55)]">
          {(["left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl",
            "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl"] as const).map((c) => (
            <span key={c} className={cn("absolute size-10 border-scan", c)} />
          ))}
          {status === "ready" && (
            <span className="absolute inset-x-5 top-1/2 h-0.5 animate-scanline rounded-full bg-scan shadow-[0_0_18px_4px_rgb(229_36_47/0.6)]" />
          )}
        </div>
      </div>

      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <ScanLine className="size-10 text-ink-mute" />
          <p className="max-w-xs text-sm text-ink-dim">
            {status === "starting" && "Kamera açılıyor…"}
            {status === "denied" && "Kamera izni verilmedi. Tarayıcı ayarlarından bu siteye kamera izni verin veya barkodu elle girin."}
            {status === "error" && "Kamera başlatılamadı. Barkodu elle girebilirsiniz."}
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-5">
        <button
          onClick={onManual}
          className="glass flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-ink"
        >
          <Keyboard className="size-4" /> Elle gir
        </button>
        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className={cn("glass grid size-12 place-items-center rounded-full", torchOn && "bg-warn/30 text-warn")}
            aria-label="Fener"
          >
            {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
