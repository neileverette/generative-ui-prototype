import { Mic, Square } from 'lucide-react';
import { VoiceState } from '../hooks/useVoiceDictation';

interface VoiceButtonProps {
  voiceState: VoiceState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

/**
 * VoiceButton Component
 *
 * Centered voice input button that toggles between:
 * - Idle: Purple mic button - "Start Voice Input"
 * - Listening/Transcribing: Red stop button - "Stop Listening"
 */
export function VoiceButton({
  voiceState,
  onStart,
  onStop,
  disabled = false,
}: VoiceButtonProps) {
  const isActive = voiceState !== 'idle';

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2
        px-6 py-3
        rounded-full
        font-medium
        transition-all duration-200
        shadow-lg hover:shadow-xl
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${
          isActive
            ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500'
            : 'bg-accent-primary hover:bg-accent-primary/90 text-white focus:ring-accent-primary'
        }
      `}
      title={isActive ? 'Stop listening' : 'Start voice input'}
      aria-label={isActive ? 'Stop listening' : 'Start voice input'}
    >
      {isActive ? (
        <>
          <Square className="w-5 h-5" fill="currentColor" />
          <span>Stop Listening</span>
        </>
      ) : (
        <>
          <Mic className="w-5 h-5" />
          <span>Voice Input</span>
        </>
      )}
    </button>
  );
}
