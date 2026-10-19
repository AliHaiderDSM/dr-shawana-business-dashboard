import { useCallback, useEffect, useRef, useState } from 'react';

const FORMATS = [
  { mime: 'audio/mp4;codecs=mp4a.40.2', type: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/mp4', type: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/webm;codecs=opus', type: 'audio/webm', ext: 'webm' },
  { mime: 'audio/webm', type: 'audio/webm', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', type: 'audio/ogg', ext: 'ogg' },
];

export const MAX_VOICE_SECONDS = 300;

export function voiceSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function pickFormat() {
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mime)) ?? null;
}

interface Session {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  format: (typeof FORMATS)[number];
  startedAt: number;
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const session = useRef<Session | null>(null);

  const release = useCallback(() => {
    session.current?.stream.getTracks().forEach((t) => t.stop());
    session.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  const start = useCallback(async () => {
    const format = pickFormat();
    if (!format) throw new Error('This browser cannot record voice notes.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: format.mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    session.current = { recorder, stream, chunks, format, startedAt: Date.now() };
    recorder.start(250);
    setSeconds(0);
    setRecording(true);
  }, []);

  const stop = useCallback(
    () =>
      new Promise<{ file: File; durationMs: number } | null>((resolve) => {
        const current = session.current;
        if (!current || current.recorder.state === 'inactive') {
          release();
          resolve(null);
          return;
        }
        current.recorder.onstop = () => {
          const blob = new Blob(current.chunks, { type: current.format.type });
          const durationMs = Date.now() - current.startedAt;
          release();
          resolve(
            blob.size
              ? {
                  file: new File([blob], `voice-${Date.now()}.${current.format.ext}`, {
                    type: current.format.type,
                  }),
                  durationMs,
                }
              : null,
          );
        };
        current.recorder.stop();
      }),
    [release],
  );

  const cancel = useCallback(() => {
    const current = session.current;
    if (current && current.recorder.state !== 'inactive') {
      current.recorder.onstop = null;
      current.recorder.stop();
    }
    release();
  }, [release]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => cancel, [cancel]);

  return { recording, seconds, start, stop, cancel };
}
