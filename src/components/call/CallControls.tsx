"use client";

import { Button } from "@/components/ui/button";
import { Mic, MicOff, PauseCircle, PlayCircle, PhoneOff, PhoneIncoming, PhoneForwarded } from "lucide-react";
import type { CallState } from "@/types/call";

interface CallControlsProps {
  callState: CallState;
  isMuted: boolean;
  isOnHold: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onHangup: () => void;
  onAnswer?: () => void; // For incoming calls
  // onTransfer?: () => void; // Placeholder for future transfer functionality
}

export function CallControls({
  callState,
  isMuted,
  isOnHold,
  onMuteToggle,
  onHoldToggle,
  onHangup,
  onAnswer,
  // onTransfer,
}: CallControlsProps) {
  const showControls = callState === 'active' || callState === 'held' || callState === 'ringing' || callState === 'early' || callState === 'answering';
  const showAnswerButton = callState === 'incoming' && onAnswer;

  if (!showControls && !showAnswerButton) {
    return null; // Don't render controls if not in an active/held/ringing/incoming call state
  }

  return (
    <div className="flex items-center justify-center space-x-3 p-4 bg-card rounded-xl shadow-xl mt-4">
      {showAnswerButton && (
        <Button
          variant="default"
          size="lg"
          className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full p-4 h-auto aspect-square transition-transform active:scale-90"
          onClick={onAnswer}
          aria-label="Answer call"
        >
          <PhoneIncoming size={32} />
        </Button>
      )}

      {showControls && (
        <>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
            onClick={onMuteToggle}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
            onClick={onHoldToggle}
            aria-label={isOnHold ? "Unhold" : "Hold"}
            disabled={callState !== 'active' && callState !== 'held'} // Can only hold/unhold active calls
          >
            {isOnHold ? <PlayCircle size={28} className="text-primary" /> : <PauseCircle size={28} />}
          </Button>
          
          {/* Placeholder for Transfer button - future feature
          {onTransfer && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
              onClick={onTransfer}
              aria-label="Transfer call"
              disabled={callState !== 'active'}
            >
              <PhoneForwarded size={28} />
            </Button>
          )}
          */}
        </>
      )}

      {(showControls || showAnswerButton) && ( // Hangup button always visible if any controls are shown
          <Button
            variant="destructive"
            size="lg"
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-4 h-auto aspect-square transition-transform active:scale-90"
            onClick={onHangup} // Decline for incoming, Hangup for active/held
            aria-label={callState === 'incoming' ? "Decline call" : "Hang up call"}
          >
            <PhoneOff size={28} />
          </Button>
        )}
    </div>
  );
}
