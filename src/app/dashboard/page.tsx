
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { TelnyxRTC, Call as TelnyxCall, VERTO_PROTOCOL_VERSION } from '@telnyx/webrtc';
import { Dialpad } from '@/components/call/Dialpad';
import { CallDisplay } from '@/components/call/CallDisplay';
import { CallControls } from '@/components/call/CallControls';
import { CallHistory } from '@/components/history/CallHistory';
import { IncomingCallAlert } from '@/components/call/IncomingCallAlert';
import type { CallState, CallLogEntry } from '@/types/call';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

// IMPORTANT: CALLER_ID_NUMBER needs to be configured with your actual Telnyx Caller ID.
// SIP Username and Password will now be read from cookies set during login.
const CALLER_ID_NUMBER = "YOUR_CALLER_ID_NUMBER"; // e.g., +15551234567

function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined; // Ensure it runs client-side
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

export default function DashboardPage() {
  const [currentDialNumber, setCurrentDialNumber] = useState<string>('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [cname, setCname] = useState<string | undefined>(undefined);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [activeCallNumber, setActiveCallNumber] = useState<string | undefined>(undefined);
  
  const { toast } = useToast();

  const [telnyxClient, setTelnyxClient] = useState<TelnyxRTC | null>(null);
  const [currentCall, setCurrentCall] = useState<TelnyxCall | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCallDetails, setIncomingCallDetails] = useState<{ call: TelnyxCall; callerNumber: string; callerName?: string } | null>(null);


  const mapTelnyxStateToCallState = (telnyxState: string): CallState => {
    switch (telnyxState) {
      case TelnyxRTC.VERTO_STATES.NEW: return 'new';
      case TelnyxRTC.VERTO_STATES.REQUESTING: return 'requesting';
      case TelnyxRTC.VERTO_STATES.TRYING: return 'trying';
      case TelnyxRTC.VERTO_STATES.RECOVERING: return 'recovering';
      case TelnyxRTC.VERTO_STATES.RINGING: return 'ringing';
      case TelnyxRTC.VERTO_STATES.ANSWERING: return 'answering';
      case TelnyxRTC.VERTO_STATES.EARLY: return 'early';
      case TelnyxRTC.VERTO_STATES.ACTIVE: return 'active';
      case TelnyxRTC.VERTO_STATES.HELD: return 'held';
      case TelnyxRTC.VERTO_STATES.HANGUP: return 'hangup';
      case TelnyxRTC.VERTO_STATES.DESTROY: return 'destroy';
      case TelnyxRTC.VERTO_STATES.PURGE: return 'purge';
      default: return 'idle';
    }
  };

  useEffect(() => {
    const audioEl = document.getElementById('remoteAudio') as HTMLAudioElement;
    if (audioEl) {
      remoteAudioRef.current = audioEl;
    } else {
      console.error("Remote audio element not found");
      toast({ title: "Audio Error", description: "Could not find audio output element.", variant: "destructive"});
    }

    const sipUsernameFromCookie = getCookieValue('telnyx_sip_username');
    const sipPasswordFromCookie = getCookieValue('telnyx_sip_password');

    if (!sipUsernameFromCookie || !sipPasswordFromCookie) {
      toast({
        title: "Authentication Error",
        description: "SIP credentials not found. Please log in again.",
        variant: "destructive",
        duration: 10000,
      });
      setCallState('disconnected');
      return;
    }
    
    if (CALLER_ID_NUMBER === "YOUR_CALLER_ID_NUMBER") {
      toast({
        title: "Configuration Needed",
        description: "Please update CALLER_ID_NUMBER in src/app/dashboard/page.tsx to enable WebRTC calling.",
        variant: "destructive",
        duration: 10000,
      });
      setCallState('disconnected'); 
      return;
    }

    const client = new TelnyxRTC({
      login: sipUsernameFromCookie,
      password: sipPasswordFromCookie,
    });

    setCallState('connecting');

    client.on('telnyx.ready', () => {
      setTelnyxClient(client);
      setCallState('connected');
      toast({ title: "Telnyx Connected", description: "Ready to make and receive calls." });
    });

    client.on('telnyx.error', (error: any) => {
      console.error('Telnyx Client Error:', error);
      toast({ title: "Telnyx Error", description: error.message || "Connection failed. Check credentials and network.", variant: "destructive" });
      setCallState('disconnected');
    });

    client.on('telnyx.socket.close', (error: any) => {
      console.warn('Telnyx Socket Closed:', error);
      setCallState('disconnected');
      setTelnyxClient(null); 
      toast({ title: "Telnyx Disconnected", description: "Connection to Telnyx lost.", variant: "destructive" });
    });
    
    client.on('telnyx.notification', (notification: any) => {
      console.log('Telnyx Notification:', notification);
      if (notification.type === 'callUpdate' && notification.call) {
        const call = notification.call as TelnyxCall;
        if (call.state === TelnyxRTC.VERTO_STATES.RINGING && call.direction === 'inbound') {
          if (currentCall) {
            call.hangup();
            toast({ title: "Call Rejected", description: "Another call is already in progress.", variant: "destructive"});
            return;
          }
          setIsReceivingCall(true);
          setIncomingCallDetails({
            call: call,
            callerNumber: call.remoteCallerNumber || "Unknown Number",
            callerName: call.remoteCallerName || undefined,
          });
          setCallState('incoming'); 
          setCurrentCall(call); 
          attachCallListeners(call);
        }
      }
    });

    client.connect();

    return () => {
      client.disconnect();
      setTelnyxClient(null);
      if (currentCall) {
        currentCall.hangup();
        setCurrentCall(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const attachCallListeners = useCallback((call: TelnyxCall) => {
    call.on('telnyx.stream', (streamEvent: any) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = streamEvent.stream;
      }
    });

    call.on('telnyx.stateChange', (stateChangeEvent: { state: string }) => {
      const newUiState = mapTelnyxStateToCallState(stateChangeEvent.state);
      setCallState(newUiState);
      setCname(call.remoteCallerName || undefined);
      setActiveCallNumber(call.remoteCallerNumber || call.options.destinationNumber);


      if (newUiState === 'active' && !callStartTime) {
        setCallStartTime(Date.now());
      }

      if (newUiState === 'hangup' || newUiState === 'destroy') {
        handleCallEnd(call, newUiState);
      }
    });
    
    call.on('hangup', (params: any) => {
      console.log('Call hangup event:', params);
      setCallState('hangup');
      handleCallEnd(call, 'hangup');
    });

    call.on('destroy', () => {
      console.log('Call destroy event');
      setCallState('destroy');
      handleCallEnd(call, 'destroy');
    });

    call.on('error', (error: any) => {
      console.error('Call Error:', error);
      toast({ title: "Call Error", description: error.message || "An error occurred during the call.", variant: "destructive" });
      setCallState('hangup'); 
      handleCallEnd(call, 'hangup'); 
    });

  }, [callStartTime, toast]);


  const addCallToLog = useCallback((entry: Omit<CallLogEntry, 'id' | 'durationInSeconds'> & { durationInSeconds?: number }) => {
    const duration = entry.durationInSeconds ?? (callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0);
    const finalEntry: CallLogEntry = {
      ...entry,
      id: uuidv4(),
      durationInSeconds: duration,
    };
    setCallLog(prevLog => [finalEntry, ...prevLog]);
  }, [callStartTime]);

  const resetCallVisualState = useCallback(() => {
    setCname(undefined);
    setIsMuted(false);
    setIsOnHold(false);
    setCallStartTime(null);
    setCurrentDialNumber('');
    setActiveCallNumber(undefined);
    setIsReceivingCall(false);
    setIncomingCallDetails(null);
    
    if (telnyxClient && telnyxClient.isConnected) {
         setCallState('connected');
    } else if (telnyxClient) {
        setCallState('connecting'); 
    } else {
        setCallState('idle');
    }

  }, [telnyxClient]);

  const handleCallEnd = useCallback((callEnded: TelnyxCall, finalState: CallState) => {
    const numberForLog = callEnded.remoteCallerNumber || callEnded.options.destinationNumber || "Unknown";
    const cnameForLog = callEnded.remoteCallerName || undefined;
    const callTypeForLog: CallLogEntry['type'] = callEnded.direction === 'inbound' ? (finalState === 'active' || callStartTime ? 'incoming' : 'missed') : 'outgoing';
    
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    if (callStartTime || callTypeForLog === 'missed') { 
        addCallToLog({ 
          phoneNumber: numberForLog, 
          cname: cnameForLog, 
          type: callTypeForLog, 
          startTime: callStartTime || Date.now(), 
          durationInSeconds: duration,
          status: finalState
        });
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null; 
    }
    setCurrentCall(null); 
    resetCallVisualState();

  }, [addCallToLog, callStartTime, resetCallVisualState]);
  
  const handleMakeCall = useCallback(async (numberToCall: string) => {
    if (!telnyxClient || !telnyxClient.isConnected) {
      toast({ title: "Not Connected", description: "Telnyx client is not connected.", variant: "destructive" });
      return;
    }
    if (currentCall) {
      toast({ title: "Call In Progress", description: "Please end the current call before starting a new one.", variant: "destructive" });
      return;
    }

    if (CALLER_ID_NUMBER === "YOUR_CALLER_ID_NUMBER") {
      toast({ title: "Configuration Error", description: "Please set your CALLER_ID_NUMBER in src/app/dashboard/page.tsx.", variant: "destructive"});
      return;
    }

    const newCall = telnyxClient.newCall({
      destinationNumber: numberToCall,
      callerNumber: CALLER_ID_NUMBER, 
      callerName: "WebRTC Talk App", 
    });
    
    setCurrentCall(newCall);
    attachCallListeners(newCall);
    setActiveCallNumber(numberToCall);
    setCallState('new'); 

  }, [telnyxClient, currentCall, toast, attachCallListeners]);

  const handleHangup = useCallback(() => {
    if (isReceivingCall && incomingCallDetails?.call) { 
        incomingCallDetails.call.hangup();
        toast({ title: "Call Declined", description: `Incoming call from ${incomingCallDetails.callerNumber} declined.`});
        addCallToLog({ 
            phoneNumber: incomingCallDetails.callerNumber, 
            cname: incomingCallDetails.callerName, 
            type: 'missed', 
            startTime: Date.now(), 
            status: 'hangup' 
        });
        setIsReceivingCall(false);
        setIncomingCallDetails(null);
        setCurrentCall(null); 
        resetCallVisualState();
        return;
    }

    if (currentCall) {
      currentCall.hangup();
    } else {
      resetCallVisualState();
    }
  }, [currentCall, isReceivingCall, incomingCallDetails, toast, addCallToLog, resetCallVisualState]);


  const handleMuteToggle = () => {
    if (currentCall && (callState === 'active' || callState === 'held')) {
      if (isMuted) {
        currentCall.unmute();
        setIsMuted(false);
        toast({ title: "Unmuted" });
      } else {
        currentCall.mute();
        setIsMuted(true);
        toast({ title: "Muted" });
      }
    }
  };

  const handleHoldToggle = () => {
    if (currentCall && callState === 'active') {
      currentCall.hold();
      setIsOnHold(true);
      toast({ title: "Call on Hold" });
    } else if (currentCall && callState === 'held') {
      currentCall.unhold();
      setIsOnHold(false);
      toast({ title: "Call Resumed" });
    }
  };
  
  const handleAnswerIncomingCall = () => {
    if (incomingCallDetails?.call) {
      incomingCallDetails.call.answer();
      setActiveCallNumber(incomingCallDetails.callerNumber);
      setCname(incomingCallDetails.callerName);
      setCallStartTime(Date.now());
      setIsReceivingCall(false); 
      setIncomingCallDetails(null);
      toast({ title: "Call Answered", description: `Connected to ${incomingCallDetails.callerName || incomingCallDetails.callerNumber}` });
    }
  };

  const dialpadDisabled = !(callState === 'connected' || callState === 'idle' || callState === 'disconnected') || !!currentCall || isReceivingCall;


  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-6">
      {isReceivingCall && incomingCallDetails && (
        <IncomingCallAlert
          callerNumber={incomingCallDetails.callerNumber}
          callerName={incomingCallDetails.callerName}
          onAnswer={handleAnswerIncomingCall}
          onDecline={handleHangup} 
        />
      )}
      
      <CallDisplay 
        callState={callState} 
        cname={cname} 
        currentNumber={ activeCallNumber || (isReceivingCall && incomingCallDetails ? incomingCallDetails.callerNumber : currentDialNumber) }
        callStartTime={callStartTime}
      />

      <CallControls
        callState={callState}
        isMuted={isMuted}
        isOnHold={isOnHold}
        onMuteToggle={handleMuteToggle}
        onHoldToggle={handleHoldToggle}
        onHangup={handleHangup}
        onAnswer={(isReceivingCall && incomingCallDetails) ? handleAnswerIncomingCall : undefined}
      />
      
      { (callState === 'connected' || callState === 'idle' || callState === 'disconnected' ) && !currentCall && !isReceivingCall &&
        <Dialpad
          currentNumber={currentDialNumber}
          onNumberChange={setCurrentDialNumber}
          onMakeCall={handleMakeCall}
          disabled={dialpadDisabled}
        />
      }
      
      <CallHistory callLog={callLog} />
    </div>
  );
}

