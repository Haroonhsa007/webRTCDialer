
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
    console.log("DashboardPage: useEffect for Telnyx client setup triggered.");
    const audioEl = document.getElementById('remoteAudio') as HTMLAudioElement;
    if (audioEl) {
      remoteAudioRef.current = audioEl;
    } else {
      console.error("DashboardPage: Remote audio element not found");
      toast({ title: "Audio Error", description: "Could not find audio output element.", variant: "destructive", duration: 10000});
    }

    const sipUsernameFromCookie = getCookieValue('telnyx_sip_username');
    const sipPasswordFromCookie = getCookieValue('telnyx_sip_password');

    console.log("DashboardPage: Attempting to retrieve SIP credentials from cookies.");
    console.log("DashboardPage: SIP Username from cookie:", sipUsernameFromCookie ? "**** (present)" : "NOT FOUND");
    // Avoid logging the actual password, even to console, if possible. Just confirm its presence.
    console.log("DashboardPage: SIP Password from cookie:", sipPasswordFromCookie ? "**** (present)" : "NOT FOUND");


    if (!sipUsernameFromCookie || !sipPasswordFromCookie) {
      console.warn("DashboardPage: SIP credentials not found in cookies.");
      toast({
        title: "Authentication Error",
        description: "SIP credentials not found. Please log in again.",
        variant: "destructive",
        duration: 10000, 
      });
      setCallState('disconnected');
      if (typeof window !== 'undefined') {
        console.log("DashboardPage: Redirecting to /login due to missing credentials.");
        window.location.href = '/login';
      }
      return;
    }
    
    if (CALLER_ID_NUMBER === "YOUR_CALLER_ID_NUMBER") {
      console.warn("DashboardPage: CALLER_ID_NUMBER is not configured.");
      toast({
        title: "Configuration Needed",
        description: "Please update CALLER_ID_NUMBER in src/app/dashboard/page.tsx to enable WebRTC calling.",
        variant: "destructive",
        duration: 10000,
      });
      setCallState('disconnected'); 
      return; 
    }

    console.log("DashboardPage: Initializing TelnyxRTC client with retrieved credentials.");
    console.log("DashboardPage: Using SIP Username for TelnyxRTC:", sipUsernameFromCookie); 
    // DO NOT log password here for security, but you've confirmed its presence above.

    const client = new TelnyxRTC({
      login: sipUsernameFromCookie,
      password: sipPasswordFromCookie,
    });

    setCallState('connecting');
    console.log("DashboardPage: TelnyxRTC client instance created. Current callState: 'connecting'.");

    const handleTelnyxReady = () => {
      console.log('Telnyx Client Ready! Client Object:', client);
      setTelnyxClient(client);
      setCallState('connected');
      toast({ title: "Telnyx Connected", description: "Ready to make and receive calls." });
    };

    const handleTelnyxError = (error: any) => {
      console.error('Telnyx Client Error:', error);
      let errorMessage = "Connection failed. Check credentials and network.";
      if (error && error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({ title: "Telnyx Error", description: errorMessage, variant: "destructive", duration: 10000 });
      setCallState('disconnected');
    };

    const handleTelnyxSocketClose = (event: any) => {
      console.warn('Telnyx Socket Closed:', event);
      setCallState('disconnected');
      setTelnyxClient(null); 
      toast({ title: "Telnyx Disconnected", description: "Connection to Telnyx lost. Please check your network or try logging in again.", variant: "destructive", duration: 10000 });
    };
    
    const handleTelnyxNotification = (notification: any) => {
      console.log('Telnyx Notification:', notification);
      if (notification.type === 'callUpdate' && notification.call) {
        const call = notification.call as TelnyxCall;
        if (call.state === TelnyxRTC.VERTO_STATES.RINGING && call.direction === 'inbound') {
          if (currentCall || isReceivingCall) { // Check if already in a call or another call is ringing
            console.warn("DashboardPage: Incoming call received while another call is active or ringing. Rejecting new call.");
            try {
              call.hangup({ cause: 'USER_BUSY', causeCode: 486 }); // Standard "User Busy"
            } catch (e) {
              console.warn("DashboardPage: Failed to hangup new incoming call while busy:", e);
              try { call.hangup(); } catch (e2) { console.error("Fallback hangup failed:", e2); }
            }
            toast({ title: "Call Rejected", description: "Another call is already in progress or ringing.", variant: "destructive"});
            return;
          }
          console.log("DashboardPage: Incoming call detected. Setting up for incoming call alert.");
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
      } else if (notification.type === 'userMediaError') {
        console.error("Telnyx User Media Error:", notification.error);
        toast({ title: "Media Error", description: notification.error?.message || "Could not access microphone/camera.", variant: "destructive", duration: 10000});
      }
    };

    console.log("DashboardPage: Attaching Telnyx client event listeners.");
    client.on('telnyx.ready', handleTelnyxReady);
    client.on('telnyx.error', handleTelnyxError);
    client.on('telnyx.socket.close', handleTelnyxSocketClose);
    client.on('telnyx.notification', handleTelnyxNotification);

    console.log("DashboardPage: Calling client.connect()...");
    try {
      client.connect();
    } catch (e) {
      console.error("DashboardPage: Error thrown synchronously from client.connect():", e);
      handleTelnyxError(e); // Treat synchronous errors similarly
    }
    

    return () => {
      console.log("DashboardPage: useEffect cleanup. Disconnecting Telnyx client and removing listeners.");
      if (client) { // Ensure client exists before trying to operate on it
        client.off('telnyx.ready', handleTelnyxReady);
        client.off('telnyx.error', handleTelnyxError);
        client.off('telnyx.socket.close', handleTelnyxSocketClose);
        client.off('telnyx.notification', handleTelnyxNotification);
        try {
          client.disconnect();
        } catch (e) {
          console.warn("DashboardPage: Error during client.disconnect() in cleanup:", e);
        }
      }
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
    console.log(`DashboardPage: Attaching listeners to call ID: ${call.id}`);
    call.on('telnyx.stream', (streamEvent: any) => {
      console.log(`DashboardPage: telnyx.stream event for call ${call.id}. Attaching to remoteAudio element.`);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = streamEvent.stream;
      } else {
        console.error(`DashboardPage: remoteAudioRef.current is null. Cannot play remote stream for call ${call.id}.`);
      }
    });

    call.on('telnyx.stateChange', (stateChangeEvent: { state: string }) => {
      const newUiState = mapTelnyxStateToCallState(stateChangeEvent.state);
      console.log(`DashboardPage: telnyx.stateChange for call ${call.id}. Telnyx state: ${stateChangeEvent.state}, UI state: ${newUiState}`);
      setCallState(newUiState);
      setCname(call.remoteCallerName || undefined);
      setActiveCallNumber(call.remoteCallerNumber || call.options.destinationNumber);


      if (newUiState === 'active' && !callStartTime) {
        console.log(`DashboardPage: Call ${call.id} became active. Setting callStartTime.`);
        setCallStartTime(Date.now());
      }

      if (newUiState === 'hangup' || newUiState === 'destroy') {
        console.log(`DashboardPage: Call ${call.id} ended with state ${newUiState}.`);
        handleCallEnd(call, newUiState);
      }
    });
    
    call.on('hangup', (params: any) => {
      console.log(`DashboardPage: Call hangup event for call ${call.id}:`, params);
      setCallState('hangup');
      handleCallEnd(call, 'hangup');
    });

    call.on('destroy', () => {
      console.log(`DashboardPage: Call destroy event for call ${call.id}`);
      setCallState('destroy');
      handleCallEnd(call, 'destroy');
    });

    call.on('error', (error: any) => {
      console.error(`DashboardPage: Call Error for call ${call.id}:`, error);
      toast({ title: "Call Error", description: error.message || "An error occurred during the call.", variant: "destructive", duration: 10000 });
      setCallState('hangup'); 
      handleCallEnd(call, 'hangup'); 
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStartTime, toast]); // Dependencies: callStartTime, toast, addCallToLog (implicitly via handleCallEnd), mapTelnyxStateToCallState (stable)


  const addCallToLog = useCallback((entry: Omit<CallLogEntry, 'id' | 'durationInSeconds'> & { durationInSeconds?: number }) => {
    const duration = entry.durationInSeconds ?? (callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0);
    const finalEntry: CallLogEntry = {
      ...entry,
      id: uuidv4(),
      durationInSeconds: duration,
    };
    console.log("DashboardPage: Adding call to log:", finalEntry);
    setCallLog(prevLog => [finalEntry, ...prevLog]);
  }, [callStartTime]);

  const resetCallVisualState = useCallback(() => {
    console.log("DashboardPage: Resetting call visual state.");
    setCname(undefined);
    setIsMuted(false);
    setIsOnHold(false);
    setCallStartTime(null);
    setCurrentDialNumber('');
    setActiveCallNumber(undefined);
    setIsReceivingCall(false);
    setIncomingCallDetails(null);
    
    // Determine correct idle state based on Telnyx client's actual connection status
    if (telnyxClient && telnyxClient.isConnected) {
      console.log("DashboardPage: Telnyx client is connected, setting callState to 'connected'.");
      setCallState('connected');
    } else if (telnyxClient) { // Client exists but not connected (e.g. was connecting, or got disconnected)
      console.log("DashboardPage: Telnyx client exists but not connected, setting callState to 'disconnected'.");
      setCallState('disconnected'); // Or 'connecting' if appropriate, but disconnected is safer after a call ends/fails
    } else { // No client instance
      console.log("DashboardPage: No Telnyx client instance, setting callState to 'idle'.");
      setCallState('idle'); 
    }

  }, [telnyxClient]);

  const handleCallEnd = useCallback((callEnded: TelnyxCall, finalState: CallState) => {
    console.log(`DashboardPage: Handling call end for call ${callEnded.id}, final state: ${finalState}`);
    const numberForLog = callEnded.remoteCallerNumber || callEnded.options.destinationNumber || "Unknown";
    const cnameForLog = callEnded.remoteCallerName || undefined;
    
    // Determine if the call should be logged based on its state and type
    const wasActiveOrAnswered = callStartTime && (finalState === 'active' || finalState === 'hangup' || finalState === 'destroy' || finalState === 'held' || callState === 'answering');
    
    const callTypeForLog: CallLogEntry['type'] = callEnded.direction === 'inbound' 
      ? (wasActiveOrAnswered ? 'incoming' : 'missed') 
      : 'outgoing';
    
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    
    // Log if it was an active/answered call, a missed call, or an outgoing call that at least reached 'ringing' or beyond
    if (wasActiveOrAnswered || callTypeForLog === 'missed' || (callEnded.direction === 'outgoing' && finalState !== 'new' && finalState !== 'trying' && finalState !== 'requesting')) { 
      addCallToLog({ 
        phoneNumber: numberForLog, 
        cname: cnameForLog, 
        type: callTypeForLog, 
        startTime: callStartTime || Date.now(), // Use current time if startTime somehow wasn't set
        durationInSeconds: duration,
        status: finalState 
      });
    } else {
      console.log(`DashboardPage: Call ${callEnded.id} not logged. Was active/answered: ${wasActiveOrAnswered}, Type: ${callTypeForLog}, Final State: ${finalState}`);
    }
    
    if (remoteAudioRef.current) {
      console.log(`DashboardPage: Clearing remote audio stream for call ${callEnded.id}.`);
      remoteAudioRef.current.srcObject = null; 
      remoteAudioRef.current.load(); // Ensure the old stream is fully cleared
    }

    // Only clear currentCall if it's the one that ended
    setCurrentCall(prevCall => {
        if (prevCall && prevCall.id === callEnded.id) {
            console.log(`DashboardPage: Clearing currentCall (ID: ${callEnded.id}).`);
            return null;
        }
        console.log(`DashboardPage: currentCall (ID: ${prevCall?.id}) is different from ended call (ID: ${callEnded.id}). Not clearing.`);
        return prevCall; 
    }); 
    resetCallVisualState();

  }, [addCallToLog, callStartTime, resetCallVisualState]);
  
  const handleMakeCall = useCallback(async (numberToCall: string) => {
    console.log(`DashboardPage: Attempting to make call to ${numberToCall}.`);
    if (!telnyxClient || !telnyxClient.isConnected) {
      console.warn("DashboardPage: Cannot make call. Telnyx client is not connected.");
      toast({ title: "Not Connected", description: "Telnyx client is not connected. Please check connection or log in again.", variant: "destructive", duration: 10000 });
      setCallState('disconnected'); // Reflect that we are not connected
      return;
    }
    if (currentCall || isReceivingCall) {
      console.warn("DashboardPage: Cannot make call. Another call is in progress or ringing.");
      toast({ title: "Call In Progress", description: "Please end the current call or handle the incoming call before starting a new one.", variant: "destructive", duration: 7000 });
      return;
    }

    if (CALLER_ID_NUMBER === "YOUR_CALLER_ID_NUMBER") {
      console.warn("DashboardPage: Cannot make call. CALLER_ID_NUMBER is not configured.");
      toast({ title: "Configuration Error", description: "Please set your CALLER_ID_NUMBER in src/app/dashboard/page.tsx.", variant: "destructive", duration: 10000});
      return;
    }
    
    console.log(`DashboardPage: Creating new Telnyx call to ${numberToCall} from ${CALLER_ID_NUMBER}.`);
    const newCall = telnyxClient.newCall({
      destinationNumber: numberToCall,
      callerNumber: CALLER_ID_NUMBER, 
      callerName: "WebRTC Talk App", 
      // audio: true, // Default is true, can be explicit
      // video: false, // Default is false
    });
    
    setCurrentCall(newCall);
    attachCallListeners(newCall);
    setActiveCallNumber(numberToCall);
    setCallState('new'); // UI state indicating call initiation
    console.log(`DashboardPage: New call object created (ID: ${newCall.id}). Call state: 'new'.`);
    setCallStartTime(Date.now()); // Set start time for outgoing calls as well for duration tracking

  }, [telnyxClient, currentCall, isReceivingCall, toast, attachCallListeners]);

  const handleHangup = useCallback(() => {
    if (isReceivingCall && incomingCallDetails?.call) { 
        console.log(`DashboardPage: Declining incoming call from ${incomingCallDetails.callerNumber}. Call ID: ${incomingCallDetails.call.id}`);
        try {
          incomingCallDetails.call.hangup();
        } catch (e) {
          console.warn("DashboardPage: Error declining incoming call:", e);
        }
        toast({ title: "Call Declined", description: `Incoming call from ${incomingCallDetails.callerName || incomingCallDetails.callerNumber} declined.`});
        // Log declined call as 'missed'
        addCallToLog({ 
            phoneNumber: incomingCallDetails.callerNumber, 
            cname: incomingCallDetails.callerName, 
            type: 'missed', 
            startTime: callStartTime || Date.now(), 
            status: 'hangup' // Or a more specific 'declined' state if you add one
        });
        setIsReceivingCall(false);
        setIncomingCallDetails(null);
        setCurrentCall(null); // Ensure currentCall is cleared
        resetCallVisualState();
        return;
    }

    if (currentCall) {
      console.log(`DashboardPage: Hanging up current call. Call ID: ${currentCall.id}, State: ${currentCall.state}`);
      try {
        currentCall.hangup();
        // Call state will transition via event listener, leading to handleCallEnd
      } catch (e) {
        console.warn(`DashboardPage: Error hanging up current call (ID: ${currentCall.id}):`, e);
        // Force cleanup if hangup() throws, as events might not fire
        handleCallEnd(currentCall, 'hangup'); 
      }
    } else {
      console.log("DashboardPage: Hangup called but no current call or incoming call to hangup. Resetting state.");
      resetCallVisualState(); // Reset UI if somehow in a weird state
    }
  }, [currentCall, isReceivingCall, incomingCallDetails, toast, addCallToLog, resetCallVisualState, callStartTime, handleCallEnd]);


  const handleMuteToggle = () => {
    if (currentCall && (callState === 'active' || callState === 'held')) {
      if (isMuted) {
        console.log(`DashboardPage: Unmuting call ID: ${currentCall.id}`);
        currentCall.unmuteAudio();
        setIsMuted(false);
        toast({ title: "Unmuted" });
      } else {
        console.log(`DashboardPage: Muting call ID: ${currentCall.id}`);
        currentCall.muteAudio();
        setIsMuted(true);
        toast({ title: "Muted" });
      }
    } else {
      console.warn("DashboardPage: Mute toggle called but no active/held call or call state is not conducive.");
    }
  };

  const handleHoldToggle = () => {
    if (currentCall && callState === 'active') {
      console.log(`DashboardPage: Putting call on hold. Call ID: ${currentCall.id}`);
      currentCall.hold().then(() => {
        // State change will be handled by 'telnyx.stateChange' listener
        setIsOnHold(true); // Optimistic update or sync with state change
        toast({ title: "Call on Hold" });
      }).catch(err => {
        console.error("DashboardPage: Error putting call on hold:", err);
        toast({ title: "Hold Error", description: "Could not put call on hold.", variant: "destructive" });
      });
    } else if (currentCall && callState === 'held') {
      console.log(`DashboardPage: Resuming call from hold. Call ID: ${currentCall.id}`);
      currentCall.unhold().then(() => {
        // State change will be handled by 'telnyx.stateChange' listener
        setIsOnHold(false); // Optimistic update
        toast({ title: "Call Resumed" });
      }).catch(err => {
        console.error("DashboardPage: Error resuming call from hold:", err);
        toast({ title: "Resume Error", description: "Could not resume call.", variant: "destructive" });
      });
    } else {
       console.warn("DashboardPage: Hold toggle called but no active/held call or call state is not conducive.");
    }
  };
  
  const handleAnswerIncomingCall = () => {
    if (isReceivingCall && incomingCallDetails?.call) {
      const callToAnswer = incomingCallDetails.call;
      console.log(`DashboardPage: Answering incoming call from ${incomingCallDetails.callerNumber}. Call ID: ${callToAnswer.id}`);
      try {
        callToAnswer.answer();
        // UI updates like activeCallNumber, cname, callStartTime will be handled by 'telnyx.stateChange' listener
        // when call becomes 'active'
        setIsReceivingCall(false); 
        setIncomingCallDetails(null); 
        // setCurrentCall is already set to this incoming call instance
        toast({ title: "Call Answered", description: `Connecting to ${incomingCallDetails.callerName || incomingCallDetails.callerNumber}` });
      } catch (e) {
        console.error("DashboardPage: Error answering incoming call:", e);
        toast({ title: "Answer Error", description: "Could not answer call.", variant: "destructive" });
        // Clean up if answer fails
        setIsReceivingCall(false);
        setIncomingCallDetails(null);
        setCurrentCall(null);
        resetCallVisualState();
      }
    } else {
      console.warn("DashboardPage: Answer called but no active incoming call details found.");
    }
  };

  // Determine if dialpad should be disabled
  // Disabled if:
  // - Not in a state where new calls can be made (e.g., connecting, disconnected initially, or an error state from Telnyx)
  // - OR there's an active call
  // - OR there's an incoming call ringing
  const dialpadDisabled = !(callState === 'connected' || callState === 'idle' || callState === 'hangup' || callState === 'destroy') || !!currentCall || isReceivingCall;


  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-6">
      {isReceivingCall && incomingCallDetails && (
        <IncomingCallAlert
          callerNumber={incomingCallDetails.callerNumber}
          callerName={incomingCallDetails.callerName}
          onAnswer={handleAnswerIncomingCall}
          onDecline={handleHangup} // Decline will also use handleHangup
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
      
      {/* Show Dialpad if:
          - Telnyx client is connected OR in a state that implies it was connected and call ended (hangup, destroy) OR idle (before first connection attempt).
          - AND there is no current active/ringing call (outgoing or incoming).
      */}
      { (callState === 'connected' || callState === 'idle' || callState === 'hangup' || callState === 'destroy' ) && !currentCall && !isReceivingCall &&
        <Dialpad
          currentNumber={currentDialNumber}
          onNumberChange={setCurrentDialNumber}
          onMakeCall={handleMakeCall}
          disabled={dialpadDisabled} // Controls if buttons inside are active
        />
      }
      
      <CallHistory callLog={callLog} />
    </div>
  );
}
    
