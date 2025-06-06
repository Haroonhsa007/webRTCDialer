
"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, MicOff, PauseCircle, PlayCircle, PhoneOff, PhoneIncoming, Asterisk, Hash, PhoneForwarded, UserPlus } from "lucide-react";
import type { CallState } from "@/types/call";

interface CallControlsProps {
  callState: CallState;
  isMuted: boolean;
  isOnHold: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onHangup: () => void;
  onAnswer?: () => void;
  onSendDtmf?: (digit: string) => void;
}

const dtmfKeys = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  "*", "0", "#",
];

export function CallControls({
  callState,
  isMuted,
  isOnHold,
  onMuteToggle,
  onHoldToggle,
  onHangup,
  onAnswer,
  onSendDtmf,
}: CallControlsProps) {
  const showMainControls = callState === 'active' || callState === 'held' || callState === 'ringing' || callState === 'early' || callState === 'answering' || callState === 'new' || callState === 'trying' || callState === 'requesting';
  const showAnswerButton = callState === 'incoming' && onAnswer;
  const showDtmfPad = callState === 'active' && onSendDtmf;
  const showAdvancedControls = callState === 'active';

  if (!showMainControls && !showAnswerButton) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-4">
        <div className="flex items-center justify-center space-x-3 p-4 bg-card rounded-xl shadow-xl flex-wrap gap-2">
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

          {showMainControls && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
                    onClick={onMuteToggle}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    disabled={callState !== 'active' && callState !== 'held'}
                  >
                    {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isMuted ? "Unmute" : "Mute"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
                    onClick={onHoldToggle}
                    aria-label={isOnHold ? "Unhold" : "Hold"}
                    disabled={callState !== 'active' && callState !== 'held'}
                  >
                    {isOnHold ? <PlayCircle size={28} className="text-primary" /> : <PauseCircle size={28} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isOnHold ? "Resume Call" : "Hold Call"}</p>
                </TooltipContent>
              </Tooltip>

             {showAdvancedControls && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Button
                        variant="outline"
                        size="lg"
                        className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
                        aria-label="Transfer Call"
                        disabled
                      >
                        <PhoneForwarded size={28} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Transfer Call (Requires Backend Integration)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="lg"
                        className="rounded-full p-4 h-auto aspect-square border-2 text-foreground hover:bg-secondary transition-transform active:scale-90"
                        aria-label="Add Call"
                        disabled
                      >
                        <UserPlus size={28} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add Call / Conference (Requires Backend Integration)</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </>
          )}

          {(showMainControls || showAnswerButton) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="lg"
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-4 h-auto aspect-square transition-transform active:scale-90"
                    onClick={onHangup}
                    aria-label={callState === 'incoming' ? "Decline call" : "Hang up call"}
                  >
                    <PhoneOff size={28} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                   <p>{callState === 'incoming' ? "Decline Call" : "Hang Up"}</p>
                </TooltipContent>
              </Tooltip>
            )}
        </div>

        {showDtmfPad && (
          <div className="w-full p-4 bg-card rounded-xl shadow-xl">
            <p className="text-xs text-center text-muted-foreground mb-2">DTMF Keypad</p>
            <div className="grid grid-cols-3 gap-2">
              {dtmfKeys.map((key) => (
                <Button
                  key={`dtmf-${key}`}
                  variant="outline"
                  className="h-12 text-xl font-medium rounded-lg border-2 hover:bg-accent/10 active:bg-accent/20 transition-all duration-150 ease-in-out transform active:scale-95 shadow-sm"
                  onClick={() => onSendDtmf(key)}
                  aria-label={`Send DTMF ${key === '*' ? 'star' : key === '#' ? 'hash' : key}`}
                >
                  {key === '*' ? <Asterisk size={20} /> : key === '#' ? <Hash size={20} /> : key}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
