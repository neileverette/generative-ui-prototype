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
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4">
      {/* Listening State - Waiting for speech */}
      {voiceState === 'listening' && !transcript && (
        <div className="flex flex-col items-center animate-fade-in">
          {/* Waveform Animation */}
          <div className="flex items-center gap-1.5 mb-6">
            {[0, 100, 200, 300, 400, 500, 600].map((delay, i) => (
              <div
                key={i}
                className="w-1.5 bg-accent-primary rounded-full animate-wave"
                style={{
                  animationDelay: `${delay}ms`,
                  height: [32, 64, 48, 80, 40, 64, 48][i],
                }}
              />
            ))}
          </div>

          {/* Helper Text */}
          <p className="text-lg text-text-secondary text-center max-w-md">
            Listening... Try giving a command like "what's my CPU usage"
          </p>
        </div>
      )}

      {/* Transcribing State - Live text */}
      {(voiceState === 'transcribing' || transcript) && (
        <div
          ref={transcriptRef}
          className="w-full max-h-72 overflow-y-auto scrollbar-hide animate-fade-in"
          style={{
            // Fade mask for long content - starts at 5% so text has more visible area
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%)',
          }}
        >
          <p className="text-4xl md:text-5xl font-light text-text-primary text-center leading-relaxed">
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
