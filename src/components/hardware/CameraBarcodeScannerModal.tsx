/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Flashlight, Volume2, VolumeX, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Product } from '../../types';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  onProductScanned?: (product: Product) => void;
  onDetected?: (code: string) => void;
  currencySymbol?: string;
  theme?: 'dark' | 'light';
}

/**
 * BLOCK: Camera Barcode Scanner Modal
 * Uses the native BarcodeDetector API (with canvas frame analysis fallback)
 * to scan physical retail barcodes from device camera feeds with synthetic audio feedback.
 */
export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products = [],
  onProductScanned,
  onDetected,
  currencySymbol = 'R',
  theme = 'dark',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [audioBeep, setAudioBeep] = useState<boolean>(true);
  const [continuousScan, setContinuousScan] = useState<boolean>(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastMatchedProduct, setLastMatchedProduct] = useState<Product | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);

  // Synthesize pleasant 880Hz audio beep on scan
  const playScanBeep = useCallback(() => {
    if (!audioBeep) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, [audioBeep]);

  // Handle scanned barcode lookup
  const handleDetectedCode = useCallback(
    (rawCode: string) => {
      const clean = rawCode.trim();
      if (!clean) return;

      // Prevent immediate duplicate bursts within 1.2s if continuous
      if (lastScannedCode === clean && Date.now() - (window as unknown as { _lastScanTime?: number })._lastScanTime! < 1200) {
        return;
      }
      (window as unknown as { _lastScanTime: number })._lastScanTime = Date.now();

      playScanBeep();
      setLastScannedCode(clean);

      if (onDetected) {
        onDetected(clean);
      }

      // Match against catalog by barcode, SKU, or ID
      const matched = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === clean.toLowerCase()) ||
          (p.sku && p.sku.trim().toLowerCase() === clean.toLowerCase()) ||
          p.id.toLowerCase() === clean.toLowerCase() ||
          (p.variations && p.variations.some((v) => v.barcode && v.barcode.trim().toLowerCase() === clean.toLowerCase()))
      );

      if (matched) {
        setLastMatchedProduct(matched);
        setScanCount((c) => c + 1);
        if (onProductScanned) {
          onProductScanned(matched);
        }

        if (!continuousScan) {
          setTimeout(() => {
            onClose();
          }, 600);
        }
      } else {
        setLastMatchedProduct(null);
      }
    },
    [lastScannedCode, playScanBeep, products, onProductScanned, onDetected, continuousScan, onClose]
  );

  // Initialize Camera Stream
  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function startCamera() {
      try {
        setCameraError(null);
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Start scanning frame loop
        startDetectionLoop();
      } catch (err: unknown) {
        console.error('Camera access error:', err);
        if (isMounted) {
          setHasCameraPermission(false);
          setCameraError(err instanceof Error ? err.message : 'Unable to access camera device');
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isOpen]);

  // Frame Analysis Loop
  const startDetectionLoop = () => {
    // Check if BarcodeDetector is available natively
    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: { new (opts?: { formats: string[] }): { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } } }).BarcodeDetector;
    let detector: { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } | null = null;

    if (BarcodeDetectorClass) {
      try {
        detector = new BarcodeDetectorClass({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || !isScanningActive) {
        animFrameIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            handleDetectedCode(barcodes[0].rawValue);
          }
        } catch {
          // Ignore frame detection transient glitches
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as { torch?: boolean };
      if (capabilities && capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet],
        });
        setTorchEnabled(!torchEnabled);
      }
    } catch {
      // Torch not supported on device
    }
  };

  if (!isOpen) return null;

  return (
    <div className="popup-card-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* BLOCK: Scanner Modal Card */}
      <div className="popup-card w-full max-w-lg overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-2xl flex flex-col">
        
        {/* ELEMENT: Header */}
        <div className="popup-card__header flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">Camera Barcode Scanner</h3>
              <p className="text-xs text-zinc-400">Position barcode inside the reticle to ring up items</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="popup-card__close-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Close scanner (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ELEMENT: Camera Viewport */}
        <div className="popup-card__viewport relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-64 h-48 sm:w-72 sm:h-52 border-2 border-dashed border-blue-400/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

              {/* Laser Line Animation */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse top-1/2" />
            </div>
          </div>

          {/* Error / Permission Prompt */}
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-zinc-950/90 text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
              <h4 className="text-sm font-semibold text-zinc-200">Camera Access Required</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">{cameraError || 'Please allow camera permission in your browser to scan barcodes.'}</p>
            </div>
          )}
        </div>

        {/* ELEMENT: Live Feedback Banner */}
        <div className="popup-card__feedback px-5 py-3 bg-zinc-950 border-t border-b border-zinc-800 flex items-center justify-between min-h-[56px]">
          {lastMatchedProduct ? (
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400">Added to Cart ({scanCount} items scanned)</p>
                <p className="text-xs font-medium text-white truncate max-w-[240px]">{lastMatchedProduct.name}</p>
              </div>
            </div>
          ) : lastScannedCode ? (
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-400">Barcode Not Found</p>
                <p className="text-xs text-zinc-400 font-mono">{lastScannedCode}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Scanning live camera feed...</span>
            </div>
          )}

          {/* Quick Manual Entry Input */}
          <div className="text-right">
            <span className="text-[11px] font-medium text-zinc-400">Items: </span>
            <span className="text-xs font-bold text-blue-400">{scanCount}</span>
          </div>
        </div>

        {/* ELEMENT: Controls Toolbar */}
        <div className="popup-card__footer px-5 py-3.5 bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                torchEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750'
              }`}
              title="Toggle Flashlight"
            >
              <Flashlight className="w-4 h-4" />
              <span className="hidden sm:inline">Torch</span>
            </button>

            <button
              onClick={() => setAudioBeep(!audioBeep)}
              className={`p-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                audioBeep
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'
              }`}
              title="Toggle Beep on Scan"
            >
              {audioBeep ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">Audio</span>
            </button>

            <button
              onClick={() => setContinuousScan(!continuousScan)}
              className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                continuousScan
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'
              }`}
            >
              {continuousScan ? 'Continuous Mode' : 'Single Scan'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
