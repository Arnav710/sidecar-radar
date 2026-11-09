"use client";

import { useEffect, useRef, useState } from "react";
import { formatOffset, offsetSince } from "@sidecar/shared";
import { Logo } from "./Logo";
import { roomLabel } from "./format";

type RoomTalk = { id: string; title: string; speaker: string; room_id: string; start: string };

// Minimal typing for the browser Speech Recognition API (Chrome: webkitSpeechRecognition).
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface Recognizer {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SpeechEvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
}

export function RoomCapture({ talk, roomKey, keyOk, joinUrl, qrSvg }: { talk: RoomTalk; roomKey: string; keyOk: boolean; joinUrl: string; qrSvg: string }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [sent, setSent] = useState<{ offset: number; text: string }[]>([]);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const rec = useRef<Recognizer | null>(null);
  const wantOn = useRef(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return setSupported(false);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal && text) post(text);
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    // Chrome stops recognition after silence; restart while the room wants it on.
    r.onend = () => (wantOn.current ? r.start() : setListening(false));
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(`Microphone: ${e.error}`);
    };
    rec.current = r;
    return () => {
      wantOn.current = false;
      r.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(text: string) {
    const offset = offsetSince(talk.start);
    setSent((s) => [{ offset, text }, ...s].slice(0, 6));
    const res = await fetch(`/api/talks/${talk.id}/lines`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-room-key": roomKey },
      body: JSON.stringify({ text, offset_s: offset }),
    }).catch(() => null);
    if (!res?.ok) setError("A caption didn't send. Check the room key and connection.");
  }

  const toggle = () => {
    if (!rec.current) return;
    setError("");
    if (listening) {
      wantOn.current = false;
      rec.current.stop();
      setListening(false);
    } else {
      wantOn.current = true;
      rec.current.start();
      setListening(true);
    }
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <section>
        <div>
          <Logo />
        </div>
        <p className="chip mt-8 bg-lilac">{roomLabel(talk.room_id)} · room laptop</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">{talk.title}</h1>
        <p className="mt-2 text-lg text-ink-soft">{talk.speaker}</p>

        {!keyOk && (
          <p className="sticker mt-6 bg-bubble p-4 font-semibold">This page needs the room key (?key=…) to post captions. Attendees should use the QR code instead.</p>
        )}
        {!supported && (
          <p className="sticker mt-6 bg-sun p-4 font-semibold">This browser can&apos;t do live speech recognition. Open this page in Chrome.</p>
        )}

        <button
          onClick={toggle}
          disabled={!keyOk || !supported}
          className={`btn mt-8 px-8 py-5 text-2xl ${listening ? "bg-tangerine text-white" : "bg-lime"}`}
        >
          {listening ? (
            <>
              <span className="inline-block h-3 w-3 animate-pulse-dot rounded-full bg-white" /> Captioning… tap to stop
            </>
          ) : (
            <>🎙️ Start captioning</>
          )}
        </button>
        {error && <p className="mt-3 font-semibold text-tangerine">{error}</p>}

        <div className="sticker mt-8 min-h-40 bg-white p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">Hearing now</p>
          <p className="mt-2 min-h-8 font-display text-xl text-ink-soft italic">{interim || (listening ? "…" : "Not listening")}</p>
          <ul className="mt-3 space-y-1.5">
            {sent.map((s, i) => (
              <li key={`${s.offset}-${i}`} className="animate-rise text-sm">
                <span className="mr-2 font-mono text-xs text-ink-soft">{formatOffset(s.offset)}</span>
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sticker flex flex-col items-center bg-paper p-6 text-center shadow-[var(--shadow-hard-lg)]" style={{ ["--tilt" as string]: "1deg" }}>
        <p className="font-display text-3xl font-extrabold">Ask this talk anything</p>
        <p className="mt-1 text-lg text-ink-soft">Scan for live captions and private questions</p>
        <div className="mt-5 w-full max-w-sm [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-4 break-all font-mono text-sm">{joinUrl}</p>
      </section>
    </main>
  );
}
