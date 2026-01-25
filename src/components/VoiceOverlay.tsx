import { useEffect, useRef } from 'react';
import { VoiceState } from '../hooks/useVoiceDictation';

interface VoiceOverlayProps {
  voiceState: VoiceState;
  transcript: string;
}

/**
 * VoiceOverlay Component
 *
 * Displays in the center of the dashboard when voice input is active.
 * Shows either:
 * - Listening state: waveform animation + helper text
 * - Transcribing state: live transcript text
 *
 * Has transparent background so wallpaper shows through.
 */
export function VoiceOverlay({ voiceState, transcript }: VoiceOverlayProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom for long transcriptions
  useEffect(() => {
    if (transcriptRef.current && transcript) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Don't render anything in idle state
  if (voiceState === 'idle') {
    return null;
  }

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4 pt-12">
      {/* Waveform Animation - Always visible when voice is active */}
      <div className="flex flex-col items-center animate-fade-in mb-8" style={{ opacity: 0.6 }}>
        {/* Waveform Animation */}
        <div className="flex items-center gap-1.5 mb-6">
          {[0, 100, 200, 300, 400, 500, 600].map((delay, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full animate-wave"
              style={{
                animationDelay: `${delay}ms`,
                height: [32, 64, 48, 80, 40, 64, 48][i],
                background: 'linear-gradient(180deg, #d946ef 0%, #06b6d4 50%, #a78bfa 100%)',
              }}
            />
          ))}
        </div>

        {/* Helper Text - Only show when listening without transcript */}
        {voiceState === 'listening' && !transcript && (
          <p className="text-lg text-white/80 text-center max-w-md">
            Listening... Try giving a command like "what's my CPU usage"
          </p>
        )}
      </div>

      {/* Transcribing State - Live text */}
      {(voiceState === 'transcribing' || transcript) && (
        <div
          ref={transcriptRef}
          className="w-full max-h-72 overflow-y-auto scrollbar-hide animate-fade-in"
        >
          <p className="text-4xl md:text-5xl font-light text-white text-center leading-relaxed">
            {transcript}
          </p>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes wave {
          0%, 100% {
            transform: scaleY(0.4);
            opacity: 0.7;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-wave {
          animation: wave 1.2s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
