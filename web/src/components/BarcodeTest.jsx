import { useEffect, useRef, useState } from 'react';
import { createBarcodeDetector } from '../lib/barcodeDetector.js';

// Hidden phone test for barcode reading (ticket 17). Open the app with ?test=barcode.
// Reads from the rear camera, logs each code with its format, engine and read time.
const SAME_CODE_WINDOW_MS = 3000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function engineLabel(engine) {
  return engine === 'native'
    ? 'native (phone BarcodeDetector)'
    : 'polyfill (zxing-wasm, self-hosted)';
}

function logText(entries) {
  const header = ['Barcode test ' + new Date().toLocaleString(), navigator.userAgent, ''];
  const rows = entries.map((e) => `${e.time}  ${e.code}  ${e.format}  ${e.engine}  ${e.ms} ms`);
  return header.concat(rows.length ? rows : ['(no reads yet)']).join('\n');
}

export default function BarcodeTest() {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [engine, setEngine] = useState(null);
  const [message, setMessage] = useState('Tap Start, then point the rear camera at a package.');
  const [log, setLog] = useState([]);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    return () => stop();
  }, []);

  function stop() {
    const session = sessionRef.current;
    if (!session) return;
    session.active = false;
    session.stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    sessionRef.current = null;
  }

  async function start() {
    stop();
    setPhase('starting');
    setMessage('Opening the rear camera…');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (error) {
      setPhase('error');
      setMessage(`Camera failed: ${error.name || 'error'} ${error.message || ''}`.trim());
      return;
    }

    const video = videoRef.current;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay can be refused; the loop below waits for frames anyway.
    }

    setMessage('Loading the barcode reader…');
    let chosen;
    try {
      chosen = await createBarcodeDetector();
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setPhase('error');
      setMessage(`Barcode reader failed to load: ${error.message}`);
      return;
    }

    const { engine: picked, detector } = chosen;
    const session = { active: true, stream, lastCode: null, lastSeen: 0, t0: performance.now() };
    sessionRef.current = session;
    setEngine(picked);
    setPhase('scanning');
    setMessage('Scanning… time counts from now, and again after each read.');

    while (session.active) {
      if (video.readyState < 2) {
        await sleep(100);
        continue;
      }
      try {
        const found = await detector.detect(video);
        if (!session.active) break;
        if (found.length) {
          const code = found[0].rawValue;
          const now = performance.now();
          const repeat = code === session.lastCode && now - session.lastSeen < SAME_CODE_WINDOW_MS;
          session.lastCode = code;
          session.lastSeen = now;
          if (!repeat) {
            const entry = {
              time: new Date().toLocaleTimeString(),
              code,
              format: found[0].format,
              engine: picked,
              ms: Math.round(now - session.t0),
            };
            setLog((prev) => [...prev, entry]);
            setMessage(`Read ${code} (${entry.format}) in ${entry.ms} ms. Point at the next one.`);
            session.t0 = performance.now();
          }
        }
      } catch (error) {
        setMessage(`Read error: ${error.message}`);
        await sleep(300);
      }
      await sleep(50);
    }
  }

  async function copyLog() {
    const text = logText(log);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied.');
    } catch {
      setCopied('Copy failed. Select the text below and copy it.');
    }
  }

  const busy = phase === 'starting' || phase === 'scanning';

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Barcode phone test</h1>
      <p style={styles.muted}>
        Hidden test screen for ticket 17. Packages to try: UPC-A, UPC-E, EAN-13, EAN-8.
      </p>

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={styles.video}
        aria-label="Camera view"
      />

      <p>
        <strong>Engine:</strong> {engine ? engineLabel(engine) : 'not started'}
      </p>
      <p role="status" style={styles.muted}>
        {message}
      </p>

      <div style={styles.row}>
        <button type="button" onClick={start} disabled={busy} style={styles.button}>
          {busy ? 'Scanning' : 'Start camera'}
        </button>
        <button type="button" onClick={stop} disabled={!busy} style={styles.button}>
          Stop
        </button>
        <button type="button" onClick={() => setLog([])} style={styles.button}>
          Clear log
        </button>
        <button type="button" onClick={copyLog} style={styles.button}>
          Copy log
        </button>
      </div>
      {copied && <p style={styles.muted}>{copied}</p>}

      <label style={styles.label}>
        Result log
        <textarea
          readOnly
          value={logText(log)}
          rows={Math.max(6, log.length + 4)}
          style={styles.log}
        />
      </label>

      {phase === 'error' && <p style={styles.muted}>Check the camera permission and try again.</p>}
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    fontFamily: 'system-ui, sans-serif',
  },
  title: { fontSize: '1.5rem', margin: 0 },
  muted: { color: '#555', fontSize: '0.9rem', margin: 0 },
  video: { width: '100%', maxHeight: 320, background: '#000', borderRadius: 12 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  button: { padding: '10px 14px', fontSize: '1rem', borderRadius: 10, minWidth: 110 },
  label: { display: 'flex', flexDirection: 'column', gap: 6 },
  log: {
    width: '100%',
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: '0.8rem',
    boxSizing: 'border-box',
  },
};
