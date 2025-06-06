
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { TelnyxRTC, Call as TelnyxCall } from '@telnyx/webrtc';
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
  if (parts.length === 2) {
    const cookieVal = parts.pop()?.split(';').shift();
    return cookieVal ? decodeURIComponent(cookieVal) : undefined;
  }
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
        description: "SIP credentials not found. Redirecting to login.",
        variant: "destructive",
        duration: 5000, 
      });
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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
      return; // Exit early if CALLER_ID_NUMBER is not configured
    }

    const client = new TelnyxRTC({
      login: sipUsernameFromCookie,
      password: sipPasswordFromCookie,
    });

    setCallState('connecting');

    const handleTelnyxReady = () => {
      setTelnyxClient(client);
      setCallState('connected');
      toast({ title: "Telnyx Connected", description: "Ready to make and receive calls." });
    };

    const handleTelnyxError = (error: any) => {
      console.error('Telnyx Client Error:', error);
      toast({ title: "Telnyx Error", description: error.message || "Connection failed. Check credentials and network.", variant: "destructive" });
      setCallState('disconnected');
    };

    const handleTelnyxSocketClose = (error: any) => {
      console.warn('Telnyx Socket Closed:', error);
      setCallState('disconnected');
      setTelnyxClient(null); 
      toast({ title: "Telnyx Disconnected", description: "Connection to Telnyx lost.", variant: "destructive" });
    };
    
    const handleTelnyxNotification = (notification: any) => {
      console.log('Telnyx Notification:', notification);
      if (notification.type === 'callUpdate' && notification.call) {
        const call = notification.call as TelnyxCall;
        if (call.state === TelnyxRTC.VERTO_STATES.RINGING && call.direction === 'inbound') {
          if (currentCall) {
            try {
              call.hangup({ cause: 'USER_BUSY', causeCode: 486 });
            } catch (e) {
              console.warn("Failed to hangup new incoming call while busy:", e);
              try { call.hangup(); } catch (e2) { console.error("Fallback hangup failed:", e2); }
            }
            toast({ title: "Call Rejected", description: "Another call is already in progress or ringing.", variant: "destructive"});
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
    };

    client.on('telnyx.ready', handleTelnyxReady);
    client.on('telnyx.error', handleTelnyxError);
    client.on('telnyx.socket.close', handleTelnyxSocketClose);
    client.on('telnyx.notification', handleTelnyxNotification);

    client.connect();

    return () => {
      client.disconnect();
      // Explicitly remove listeners as per Telnyx docs recommendation
      client.off('telnyx.ready', handleTelnyxReady);
      client.off('telnyx.error', handleTelnyxError);
      client.off('telnyx.socket.close', handleTelnyxSocketClose);
      client.off('telnyx.notification', handleTelnyxNotification);
      
      setTelnyxClient(null);
      if (currentCall) {
        try {
          currentCall.hangup();
        } catch (e) {
          console.warn("Error hanging up call on component unmount:", e);
        }
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
    const wasActiveOrAnswered = callStartTime && (finalState === 'active' || finalState === 'hangup' || finalState === 'destroy' || finalState === 'held');
    const callTypeForLog: CallLogEntry['type'] = callEnded.direction === 'inbound' 
      ? (wasActiveOrAnswered ? 'incoming' : 'missed') 
      : 'outgoing';
    
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    
    if (wasActiveOrAnswered || callTypeForLog === 'missed' || (callEnded.direction === 'outgoing' && finalState !== 'new' && finalState !== 'trying' && finalState !== 'requesting')) { 
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
      remoteAudioRef.current.load(); 
    }

    setCurrentCall(prevCall => {
        if (prevCall && prevCall.id === callEnded.id) {
            return null;
        }
        return prevCall; 
    }); 
    resetCallVisualState();

  }, [addCallToLog, callStartTime, resetCallVisualState]);
  
  const handleMakeCall = useCallback(async (numberToCall: string) => {
    if (!telnyxClient || !telnyxClient.isConnected) {
      toast({ title: "Not Connected", description: "Telnyx client is not connected.", variant: "destructive" });
      return;
    }
    if (currentCall || isReceivingCall) {
      toast({ title: "Call In Progress", description: "Please end the current call or handle the incoming call before starting a new one.", variant: "destructive" });
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
    setCallStartTime(Date.now());

  }, [telnyxClient, currentCall, isReceivingCall, toast, attachCallListeners]);

  const handleHangup = useCallback(() => {
    if (isReceivingCall && incomingCallDetails?.call) { 
        try {
          incomingCallDetails.call.hangup();
        } catch (e) {
          console.warn("Error hanging up incoming/declined call:", e);
        }
        toast({ title: "Call Declined", description: `Incoming call from ${incomingCallDetails.callerNumber} declined.`});
        addCallToLog({ 
            phoneNumber: incomingCallDetails.callerNumber, 
            cname: incomingCallDetails.callerName, 
            type: 'missed', 
            startTime: callStartTime || Date.now(), 
            status: 'hangup' 
        });
        setIsReceivingCall(false);
        setIncomingCallDetails(null);
        setCurrentCall(null); 
        resetCallVisualState();
        return;
    }

    if (currentCall) {
      try {
        currentCall.hangup();
      } catch (e) {
        console.warn("Error hanging up current call:", e);
        handleCallEnd(currentCall, 'hangup'); 
      }
    } else {
      resetCallVisualState();
    }
  }, [currentCall, isReceivingCall, incomingCallDetails, toast, addCallToLog, resetCallVisualState, callStartTime, handleCallEnd]);


  const handleMuteToggle = () => {
    if (currentCall && (callState === 'active' || callState === 'held')) {
      if (isMuted) {
        currentCall.unmuteAudio();
        setIsMuted(false);
        toast({ title: "Unmuted" });
      } else {
        currentCall.muteAudio();
        setIsMuted(true);
        toast({ title: "Muted" });
      }
    }
  };

  const handleHoldToggle = () => {
    if (currentCall && callState === 'active') {
      currentCall.hold();
      toast({ title: "Call on Hold" });
    } else if (currentCall && callState === 'held') {
      currentCall.unhold();
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

  const dialpadDisabled = !(callState === 'connected' || callState === 'idle' || callState === 'disconnected' || callState === 'hangup' ) || !!currentCall || isReceivingCall;


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
      
      { (callState === 'connected' || callState === 'idle' || callState === 'disconnected' || callState === 'hangup' ) && !currentCall && !isReceivingCall &&
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

    
