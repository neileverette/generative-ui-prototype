import { useState, useRef, useCallback, useEffect } from 'react';

// Web Speech API types (not included in standard TypeScript lib)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Voice Dictation States:
 * - idle: Normal state, not listening
 * - listening: Clicked button, waiting for speech
 * - transcribing: User is speaking, showing live text
 */
export type VoiceState = 'idle' | 'listening' | 'transcribing';

interface UseVoiceDictationConfig {
  language?: string;
  onTranscriptComplete?: (transcript: string) => void;
  onError?: (error: string) => void;
}

interface UseVoiceDictationReturn {
  voiceState: VoiceState;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  isSupported: boolean;
}

export function useVoiceDictation(config: UseVoiceDictationConfig = {}): UseVoiceDictationReturn {
  const {
    language = 'en-US',
    onTranscriptComplete,
    onError,
  } = config;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const errorMsg = 'Speech recognition not supported in this browser';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Reset state
    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';
    setVoiceState('listening');

    // Create recognition instance
    const SpeechRecognitionAPI = window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not available');
      setVoiceState('idle');
      return;
    }

    const recognition = new SpeechRecognitionAPI();

    // Configuration
    recognition.continuous = false;      // Auto-stop after pause
    recognition.interimResults = true;   // Get live results
    recognition.lang = language;

    // Handle results - fires multiple times during speech
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscriptRef.current += text;
        } else {
          interimTranscript += text;
        }
      }

      // Combine final + interim for display
      const displayText = finalTranscriptRef.current + interimTranscript;

      if (displayText.trim()) {
        setVoiceState('transcribing');
        setTranscript(displayText);
      }
    };

    // Speech started - user began talking
    recognition.onspeechstart = () => {
      setVoiceState('transcribing');
    };

    // Auto-stop triggered by silence
    recognition.onspeechend = () => {
      recognition.stop();
    };

    // Cleanup when recognition ends (auto or manual)
    recognition.onend = () => {
      const finalText = finalTranscriptRef.current.trim() || transcript.trim();

      // Send to chat if we have text
      if (finalText) {
        onTranscriptComplete?.(finalText);
      }

      // Reset to idle
      setVoiceState('idle');
      setTranscript('');
      finalTranscriptRef.current = '';
      recognitionRef.current = null;
    };

    // Error handling
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      // Don't show error for "no-speech" - that's expected if user doesn't speak
      if (event.error !== 'no-speech') {
        const errorMsg = `Speech recognition error: ${event.error}`;
        setError(errorMsg);
        onError?.(errorMsg);
      }

      setVoiceState('idle');
      setTranscript('');
      finalTranscriptRef.current = '';
      recognitionRef.current = null;
    };

    // Start recognition
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      const errorMsg = `Failed to start speech recognition: ${err}`;
      setError(errorMsg);
      onError?.(errorMsg);
      setVoiceState('idle');
    }
  }, [isSupported, language, onTranscriptComplete, onError, transcript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop(); // Triggers onend event
    }
  }, []);

  return {
    voiceState,
    transcript,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}
