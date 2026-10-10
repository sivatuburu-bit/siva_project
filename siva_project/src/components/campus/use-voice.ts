import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal Web Speech API typings */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function cleanForSpeech(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function useVoice(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState({ recognition: false, synthesis: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported({ recognition: !!getRecognitionCtor(), synthesis: "speechSynthesis" in window });
    return () => {
      recRef.current?.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const start = useCallback(() => {
    setVoiceError(null);
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setVoiceError("Voice input isn't supported in this browser. Try Chrome or Edge, or type your question.");
      return;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(finalText + interimText);
    };
    rec.onerror = (e) => {
      const map: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow the microphone in your browser's address bar, then try again.",
        "service-not-allowed": "Microphone access was blocked. Allow the microphone in your browser settings.",
        "no-speech": "I didn't hear anything. Tap the mic and try speaking again.",
        "audio-capture": "No microphone was found. Please connect one and try again.",
        network: "Voice recognition needs an internet connection.",
      };
      if (e.error !== "aborted") setVoiceError(map[e.error] ?? "Voice recognition stopped unexpectedly. Please try again.");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const t = finalText.trim();
      if (t) onFinalRef.current(t);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setVoiceError("Couldn't start the microphone. Please try again.");
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (muted || !("speechSynthesis" in window)) return;
      const clean = cleanForSpeech(text);
      if (!clean) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "en-US";
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) {
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
      return !m;
    });
  }, []);

  return { supported, listening, speaking, muted, interim, voiceError, setVoiceError, start, stop, speak, toggleMute };
}
