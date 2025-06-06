"use client";

import type { CallState } from "@/types/call";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Phone, UserCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

interface CallDisplayProps {
  callState: CallState;
  cname?: string;
  currentNumber?: string;
  callStartTime?: number | null;
}

const callStateText: Record<CallState, string> = {
  idle: "Idle",
  new: "Initializing Call...",
  trying: "Trying...",
  requesting: "Requesting...",
  recovering: "Recovering Connection...",
  ringing: "Ringing...",
  answering: "Answering...",
  early: "Connecting...",
  active: "Active Call",
  held: "Call on Hold",
  hangup: "Call Ended",
  destroy: "Call Destroyed",
  purge: "Call Purged",
  incoming: "Incoming Call...",
};

const callStateColors: Record<CallState, string> = {
  idle: "bg-muted text-muted-foreground",
  new: "bg-blue-500 text-white",
  trying: "bg-blue-500 text-white",
  requesting: "bg-blue-500 text-white",
  recovering: "bg-yellow-500 text-black",
  ringing: "bg-yellow-500 text-black",
  answering: "bg-green-500 text-white",
  early: "bg-green-500 text-white",
  active: "bg-accent text-accent-foreground",
  held: "bg-orange-500 text-white",
  hangup: "bg-red-500 text-white",
  destroy: "bg-red-600 text-white",
  purge: "bg-gray-700 text-white",
  incoming: "bg-primary text-primary-foreground",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallDisplay({ callState, cname, currentNumber, callStartTime }: CallDisplayProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (callState === 'active' && callStartTime) {
      const updateDuration = () => {
        setDuration(Math.floor((Date.now() - callStartTime) / 1000));
      };
      updateDuration(); // Initial update
      intervalId = setInterval(updateDuration, 1000);
    } else if (callState !== 'active' && callState !== 'held') {
        if (callStartTime && duration === 0){ // Set final duration if call ended before active or from held
            setDuration(Math.floor((Date.now() - callStartTime) / 1000));
        } else if (callState === 'idle' || callState === 'hangup'){ // Reset duration for new call
             setDuration(0);
        }
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [callState, callStartTime, duration]);
  
  // If call has ended but was active, keep showing last duration
  // Reset duration explicitly when call state becomes 'idle' and callStartTime is null
   useEffect(() => {
    if (callState === 'idle' && !callStartTime) {
      setDuration(0);
    }
  }, [callState, callStartTime]);


  const displayText = callStateText[callState] || "Unknown State";
  const badgeColorClass = callStateColors[callState] || "bg-gray-500 text-white";

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-center font-headline">Call Status</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-3">
        <Badge variant="outline" className={`px-4 py-2 text-sm font-medium rounded-full ${badgeColorClass} border-0`}>
          {displayText}
        </Badge>
        
        { (callState !== 'idle' && (currentNumber || cname)) &&
          <div className="text-2xl font-semibold text-foreground truncate">
             {cname || currentNumber}
          </div>
        }
        { (callState === 'active' || callState === 'held' || (duration > 0 && (callState === 'hangup' || callState === 'idle'))) && (
          <div className="flex items-center justify-center text-muted-foreground">
            <Clock size={18} className="mr-2" />
            <span>{formatDuration(duration)}</span>
          </div>
        )}
        {callState === 'incoming' && currentNumber && (
          <div className="flex items-center justify-center text-lg text-foreground">
            <Phone size={20} className="mr-2 text-primary" />
            <span>{currentNumber}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
