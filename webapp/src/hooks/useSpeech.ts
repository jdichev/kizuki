import { useCallback, useEffect, useRef, useState } from "react";

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent?.trim() ?? "";
}

/**
 * Pick the best available TTS voice.
 *
 * Priority order:
 *   1. Apple premium/enhanced voices  (com.apple.voice.enhanced | .premium)
 *   2. Any voice whose name contains "premium" or "enhanced" (case-insensitive)
 *   3. Any non-network, local-only voice for the current UI language
 *   4. Chromium/browser default (null → let the engine decide)
 */
function pickBestVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (!voices.length) {
    return null;
  }

  // Normalise the locale to a base language tag for looser matching (e.g. "en").
  const baseLang = lang.split("-")[0].toLowerCase();

  const forLang = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith(baseLang) ||
      v.lang.toLowerCase().startsWith(lang.toLowerCase())
  );

  const candidates = forLang.length ? forLang : voices;

  // 1. Apple enhanced/premium (best macOS system voices)
  const appleEnhanced = candidates.find((v) =>
    /com\.apple\.voice\.(enhanced|premium)/.test(v.voiceURI)
  );
  if (appleEnhanced) return appleEnhanced;

  // 2. Any voice advertising premium/enhanced in name or URI
  const namedEnhanced = candidates.find((v) =>
    /(premium|enhanced)/i.test(v.name + v.voiceURI)
  );
  if (namedEnhanced) return namedEnhanced;

  // 3. Any local (non-network) voice
  const localVoice = candidates.find((v) => v.localService);
  if (localVoice) return localVoice;

  return null;
}

/**
 * Wraps the Web Speech API (SpeechSynthesis). Works in both browser and
 * Electron (Chromium provides SpeechSynthesis on all platforms).
 *
 * speak() accepts HTML segments: title first, then body. Each segment is
 * queued as a separate utterance so the browser can breathe between them.
 * stop() cancels all queued and active utterances immediately.
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pendingRef = useRef(0);

  const stop = useCallback(() => {
    pendingRef.current = 0;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (htmlSegments: string[]) => {
      if (!window.speechSynthesis) {
        return;
      }

      stop();

      const texts = htmlSegments
        .map(htmlToPlainText)
        .filter((t) => t.length > 0);

      if (!texts.length) {
        return;
      }

      // Voices may not be loaded yet on first call; resolve before queuing.
      const lang = document.documentElement.lang || navigator.language || "en";
      const voice = pickBestVoice(lang);

      pendingRef.current = texts.length;
      setIsSpeaking(true);

      for (const text of texts) {
        const utterance = new SpeechSynthesisUtterance(text);

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }

        utterance.onend = () => {
          pendingRef.current -= 1;
          if (pendingRef.current <= 0) {
            setIsSpeaking(false);
          }
        };

        utterance.onerror = () => {
          pendingRef.current = 0;
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      }
    },
    [stop]
  );

  // Cancel any in-progress speech when the component using this hook unmounts.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { isSpeaking, speak, stop };
}
