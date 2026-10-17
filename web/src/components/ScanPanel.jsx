import { useEffect, useRef, useState } from 'react';
import { createBarcodeDetector } from '../lib/barcodeDetector.js';
import { isValidGtin } from '../lib/gtin.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Opens the rear camera, reads barcodes until one passes its check digit, then hands that
// code to onCode and lets go of the camera. The camera is also released when the panel
// closes or unmounts. onSearch is offered whenever the camera or reader cannot run.
const POLL_MS = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export default function ScanPanel({ onCode, onCancel, onSearch }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const [phase, setPhase] = useState('starting');
  // The latest callback, read by the loop without restarting the camera when it changes.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let active = true;
    let stream = null;

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        if (active) setPhase('cameraError');
        return;
      }
      if (!active) {
        stopStream(stream);
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay can be refused; the loop waits for frames anyway.
      }

      let detector;
      try {
        ({ detector } = await createBarcodeDetector());
      } catch {
        stopStream(stream);
        if (active) setPhase('readerError');
        return;
      }
      if (!active) {
        stopStream(stream);
        return;
      }

      setPhase('scanning');
      while (active) {
        if (video.readyState >= 2) {
          try {
            const found = await detector.detect(video);
            const code = found.map((item) => item.rawValue).find((value) => isValidGtin(value));
            if (code && active) {
              active = false;
              stopStream(stream);
              onCodeRef.current(code);
              return;
            }
          } catch {
            // A frame that fails to decode is not an error; the next one is tried.
          }
        }
        await sleep(POLL_MS);
      }
    }

    run();
    return () => {
      active = false;
      stopStream(stream);
    };
  }, []);

  const failed = phase === 'cameraError' || phase === 'readerError';
  const message = {
    starting: t('foods.scanStarting'),
    scanning: t('foods.scanHint'),
    cameraError: t('foods.scanCameraError'),
    readerError: t('foods.scanReaderError'),
  }[phase];

  return (
    <div>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-label={t('foods.scanVideoLabel')}
        hidden={failed}
        style={{ width: '100%', maxWidth: 420 }}
      />
      <p role={failed ? 'alert' : 'status'}>{message}</p>
      <button type="button" onClick={onCancel}>
        {t('foods.scanClose')}
      </button>
      {failed && (
        <button type="button" onClick={onSearch}>
          {t('foods.searchByName')}
        </button>
      )}
    </div>
  );
}
