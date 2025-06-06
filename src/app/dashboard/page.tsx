
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, AlertTriangle } from 'lucide-react';

// Function to get cookie value (runs client-side)
function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieVal = parts.pop()?.split(';').shift();
    return cookieVal ? decodeURIComponent(cookieVal) : undefined;
  }
  return undefined;
}

// localStorage key for Caller ID
const CALLER_ID_STORAGE_KEY = 'telnyx_caller_id';

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

  // State for managing Caller ID input
  const [callerIdInput, setCallerIdInput] = useState<string>('');
  const [callerId, setCallerId] = useState<string | null>(null);
  const [isCallerIdNeeded, setIsCallerIdNeeded] = useState<boolean>(false);


  // Map Telnyx's internal states to our UI CallState
  const mapTelnyxStateToCallState = (telnyxState: string): CallState => {
    // Use string literals for comparison as per Telnyx SDK examples and for robustness
    switch (telnyxState) {
      case 'new': return 'new';
      case 'requesting': return 'requesting';
      case 'trying': return 'trying';
      case 'recovering': return 'recovering';
      case 'ringing': return 'ringing';
      case 'answering': return 'answering';
      case 'early': return 'early';
      case 'active': return 'active';
      case 'held': return 'held';
      case 'hangup': return 'hangup';
      case 'destroy': return 'destroy';
      case 'purge': return 'purge';
      default: 
        console.warn(`DashboardPage: Unknown Telnyx call state received: ${telnyxState}`);
        return 'idle'; // Default to idle if state is unknown
    }
  };

  // Effect for initializing and connecting Telnyx client
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
    // console.log("DashboardPage: SIP Password from cookie:", sipPasswordFromCookie ? "**** (present)" : "NOT FOUND"); // Avoid logging password

    if (!sipUsernameFromCookie || !sipPasswordFromCookie) {
      console.warn("DashboardPage: SIP credentials not found in cookies. Redirecting to login.");
      toast({
        title: "Authentication Error",
        description: "SIP credentials not found. Please log in again.",
        variant: "destructive",
        duration: 7000, 
      });
      setCallState('disconnected'); 
      if (typeof window !== 'undefined') {
        window.location.href = '/login'; 
      }
      return; 
    }
    
    const storedCallerId = typeof window !== 'undefined' ? window.localStorage.getItem(CALLER_ID_STORAGE_KEY) : null;
    if (storedCallerId) {
      console.log("DashboardPage: Found Caller ID in localStorage:", storedCallerId);
      setCallerId(storedCallerId);
      setCallerIdInput(storedCallerId);
      setIsCallerIdNeeded(false);
    } else {
      console.warn("DashboardPage: Caller ID not found in localStorage. User input required.");
      setIsCallerIdNeeded(true);
      setCallState('disconnected'); 
    }
    
    const effectiveCallerId = callerId || storedCallerId;

    if (!sipUsernameFromCookie || !sipPasswordFromCookie || !effectiveCallerId) {
        console.warn("DashboardPage: Telnyx client initialization prerequisites not met. SIP Credentials:", !!sipUsernameFromCookie, "Caller ID:", !!effectiveCallerId);
        if (!effectiveCallerId) {
          setIsCallerIdNeeded(true);
          setCallState('disconnected');
          toast({
            title: "Configuration Needed",
            description: "Please set your Caller ID to enable calling features.",
            variant: "destructive",
            duration: 10000,
          });
        }
        return;
    }

    console.log(`DashboardPage: Initializing TelnyxRTC client with SIP Username: ${sipUsernameFromCookie} and Caller ID: ${effectiveCallerId}`);
    // Log the SDK version if possible (some SDKs expose this)
    if (TelnyxRTC.version) {
      console.log(`SDK version: ${TelnyxRTC.version}`);
    }


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
      let errorMessage = "Telnyx connection failed. Check credentials, Caller ID, and network.";
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
        
        // Use string literal for call state comparison
        if (call.state === 'ringing' && call.direction === 'inbound') {
          if (currentCall || isReceivingCall) {
            console.warn("DashboardPage: Incoming call received while another call is active or ringing. Rejecting new call.");
            try {
              call.hangup({ cause: 'USER_BUSY', causeCode: 486 });
            } catch (e) {
              console.warn("DashboardPage: Failed to hangup new incoming call while busy (USER_BUSY may not be supported):", e);
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
      handleTelnyxError(e); 
    }
    
    return () => {
      console.log("DashboardPage: useEffect (Telnyx client setup) cleanup. Disconnecting Telnyx client and removing listeners.");
      if (client) { 
        client.off('telnyx.ready', handleTelnyxReady);
        client.off('telnyx.error', handleTelnyxError);
        client.off('telnyx.socket.close', handleTelnyxSocketClose);
        client.off('telnyx.notification', handleTelnyxNotification);
        try {
          if (client.isConnected) { 
            client.disconnect();
          }
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
  }, [callerId, toast]); // Added toast to dependency array as it's used inside; `mapTelnyxStateToCallState` is stable if outside component or useCallback'd

  useEffect(() => {
    if (isCallerIdNeeded) {
      setCallState('disconnected'); 
    }
  }, [isCallerIdNeeded]);


  const handleSaveCallerId = () => {
    const trimmedCallerId = callerIdInput.trim();
    if (trimmedCallerId) {
      if (!trimmedCallerId.startsWith('+') || trimmedCallerId.length < 8) {
         toast({ title: "Invalid Caller ID Format", description: "Caller ID should be in E.164 format (e.g., +12345678900).", variant: "destructive" });
         return;
      }
      console.log("DashboardPage: Saving Caller ID to localStorage:", trimmedCallerId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CALLER_ID_STORAGE_KEY, trimmedCallerId);
      }
      setCallerId(trimmedCallerId); 
      setIsCallerIdNeeded(false);
      toast({ title: "Caller ID Saved", description: "Your Caller ID has been saved." });
    } else {
      toast({ title: "Invalid Caller ID", description: "Please enter a valid Caller ID.", variant: "destructive" });
    }
  };


  const attachCallListeners = useCallback((call: TelnyxCall) => {
    console.log(`DashboardPage: Attaching listeners to call ID: ${call.id}`);
    call.on('telnyx.stream', (streamEvent: any) => {
      console.log(`DashboardPage: telnyx.stream event for call ${call.id}. Attaching to remoteAudio element.`);
      if (remoteAudioRef.current && streamEvent.stream) {
        remoteAudioRef.current.srcObject = streamEvent.stream;
      } else {
        console.error(`DashboardPage: remoteAudioRef.current is null or stream is missing. Cannot play remote stream for call ${call.id}. Stream:`, streamEvent.stream);
      }
    });

    call.on('telnyx.stateChange', (stateChangeEvent: { state: string;prevState: string }) => {
      const newUiState = mapTelnyxStateToCallState(stateChangeEvent.state);
      console.log(`DashboardPage: telnyx.stateChange for call ${call.id}. Telnyx state: ${stateChangeEvent.state} (prev: ${stateChangeEvent.prevState}), UI state: ${newUiState}`);
      setCallState(newUiState); 
      setCname(call.remoteCallerName || undefined); 
      setActiveCallNumber(call.remoteCallerNumber || call.options.destinationNumber); 

      if (newUiState === 'active' && !callStartTimeRef.current) { // Use ref for callStartTime check here
        console.log(`DashboardPage: Call ${call.id} became active. Setting callStartTime.`);
        callStartTimeRef.current = Date.now();
        setCallStartTime(callStartTimeRef.current); 
      }

      if (newUiState === 'hangup' || newUiState === 'destroy') {
        console.log(`DashboardPage: Call ${call.id} ended with state ${newUiState}.`);
        handleCallEnd(call, newUiState); 
      }
    });
    
    call.on('hangup', (params: any) => {
      console.log(`DashboardPage: Explicit Call hangup event for call ${call.id}:`, params);
      setCallState('hangup'); 
      handleCallEnd(call, 'hangup'); 
    });

    call.on('destroy', () => {
      console.log(`DashboardPage: Explicit Call destroy event for call ${call.id}`);
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
  }, [toast]); // mapTelnyxStateToCallState is stable, handleCallEnd will be memoized

  // Ref for callStartTime to avoid including it in attachCallListeners's deps directly,
  // which could cause excessive re-attachments.
  const callStartTimeRef = useRef<number | null>(null);


  const addCallToLog = useCallback((entry: Omit<CallLogEntry, 'id' | 'durationInSeconds'> & { durationInSeconds?: number }) => {
    const currentCallStartTime = callStartTimeRef.current;
    const duration = entry.durationInSeconds ?? (currentCallStartTime ? Math.floor((Date.now() - currentCallStartTime) / 1000) : 0);
    const finalEntry: CallLogEntry = {
      ...entry,
      id: uuidv4(),
      durationInSeconds: duration,
    };
    console.log("DashboardPage: Adding call to log:", finalEntry);
    setCallLog(prevLog => [finalEntry, ...prevLog.slice(0, 49)]); // Keep max 50 entries
  }, []);


  const resetCallVisualState = useCallback(() => {
    console.log("DashboardPage: Resetting call visual state.");
    setCname(undefined);
    setIsMuted(false);
    setIsOnHold(false);
    callStartTimeRef.current = null; // Reset ref
    setCallStartTime(null); // Reset state
    setCurrentDialNumber('');
    setActiveCallNumber(undefined);
    setIsReceivingCall(false);
    setIncomingCallDetails(null);
    
    if (telnyxClient && telnyxClient.isConnected) {
      console.log("DashboardPage: Telnyx client is connected, setting callState to 'connected'.");
      setCallState('connected');
    } else if (telnyxClient) { 
      console.log("DashboardPage: Telnyx client exists but not connected, setting callState to 'disconnected'.");
      setCallState('disconnected'); 
    } else { 
      console.log("DashboardPage: No Telnyx client instance, setting callState to 'idle' (or 'disconnected' if Caller ID needed).");
      setCallState(isCallerIdNeeded ? 'disconnected' : 'idle'); 
    }
  }, [telnyxClient, isCallerIdNeeded]);


  const handleCallEnd = useCallback((callEnded: TelnyxCall, finalState: CallState) => {
    console.log(`DashboardPage: Handling call end for call ${callEnded.id}, final state: ${finalState}`);
    const numberForLog = callEnded.remoteCallerNumber || callEnded.options.destinationNumber || "Unknown";
    const cnameForLog = callEnded.remoteCallerName || undefined;
    
    const currentCallStartTime = callStartTimeRef.current;
    const wasActiveOrAnswered = currentCallStartTime || callEnded.state === 'active' || callEnded.prevState === 'active' || callEnded.state === 'answering';

    const callTypeForLog: CallLogEntry['type'] = callEnded.direction === 'inbound' 
      ? (wasActiveOrAnswered ? 'incoming' : 'missed') 
      : 'outgoing';
    
    const duration = currentCallStartTime ? Math.floor((Date.now() - currentCallStartTime) / 1000) : 0;
    
    if (wasActiveOrAnswered || callTypeForLog === 'missed' || (callEnded.direction === 'outgoing' && finalState !== 'new' && finalState !== 'trying' && finalState !== 'requesting')) { 
      addCallToLog({ 
        phoneNumber: numberForLog, 
        cname: cnameForLog, 
        type: callTypeForLog, 
        startTime: currentCallStartTime || Date.now(), 
        durationInSeconds: duration,
        status: finalState 
      });
    } else {
      console.log(`DashboardPage: Call ${callEnded.id} not logged. Was active/answered indicator: ${wasActiveOrAnswered}, Type: ${callTypeForLog}, Final State: ${finalState}`);
    }
    
    if (remoteAudioRef.current) {
      console.log(`DashboardPage: Clearing remote audio stream for call ${callEnded.id}.`);
      remoteAudioRef.current.srcObject = null; 
      remoteAudioRef.current.load();
    }

    setCurrentCall(prevCall => {
        if (prevCall && prevCall.id === callEnded.id) {
            console.log(`DashboardPage: Clearing currentCall (ID: ${callEnded.id}).`);
            return null;
        }
        console.warn(`DashboardPage: currentCall (ID: ${prevCall?.id}) is different from ended call (ID: ${callEnded.id}). Not clearing currentCall, but proceeding with reset.`);
        return prevCall; 
    }); 
    resetCallVisualState();
  }, [addCallToLog, resetCallVisualState]);

  
  const handleMakeCall = useCallback(async (numberToCall: string) => {
    console.log(`DashboardPage: Attempting to make call to ${numberToCall}. Current callState: ${callState}`);
    if (!telnyxClient || !telnyxClient.isConnected) {
      console.warn("DashboardPage: Cannot make call. Telnyx client is not connected.");
      toast({ title: "Not Connected", description: "Telnyx client is not connected. Please check connection, credentials, and Caller ID.", variant: "destructive", duration: 10000 });
      setCallState('disconnected');
      return;
    }
    if (currentCall || isReceivingCall) {
      console.warn("DashboardPage: Cannot make call. Another call is in progress or ringing.");
      toast({ title: "Call In Progress", description: "Please end the current call or handle the incoming call before starting a new one.", variant: "destructive", duration: 7000 });
      return;
    }
    
    const effectiveCallerId = typeof window !== 'undefined' ? window.localStorage.getItem(CALLER_ID_STORAGE_KEY) : null;
    if (!effectiveCallerId) {
        console.warn("DashboardPage: Cannot make call. Caller ID is not set in localStorage or state.");
        toast({ title: "Caller ID Missing", description: "Please set your Caller ID before making a call.", variant: "destructive", duration: 10000});
        setIsCallerIdNeeded(true);
        return;
    }
    
    console.log(`DashboardPage: Creating new Telnyx call to ${numberToCall} from ${effectiveCallerId}.`);
    const newCall = telnyxClient.newCall({
      destinationNumber: numberToCall,
      callerNumber: effectiveCallerId, 
      callerName: "WebRTC Talk App", 
    });
    
    setCurrentCall(newCall);
    attachCallListeners(newCall);
    setActiveCallNumber(numberToCall);
    setCallState('new'); 
    console.log(`DashboardPage: New call object created (ID: ${newCall.id}). Call state: 'new'.`);
    callStartTimeRef.current = Date.now(); // Set start time for outgoing calls immediately
    setCallStartTime(callStartTimeRef.current);


  }, [telnyxClient, currentCall, isReceivingCall, toast, attachCallListeners, callState]);


  const handleHangup = useCallback(() => {
    if (isReceivingCall && incomingCallDetails?.call) { 
        const callToDecline = incomingCallDetails.call;
        console.log(`DashboardPage: Declining incoming call from ${incomingCallDetails.callerNumber}. Call ID: ${callToDecline.id}`);
        try {
          callToDecline.hangup();
        } catch (e) {
          console.warn("DashboardPage: Error declining incoming call:", e);
          handleCallEnd(callToDecline, 'hangup');
        }
        toast({ title: "Call Declined", description: `Incoming call from ${incomingCallDetails.callerName || incomingCallDetails.callerNumber} declined.`});
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
      const callToHangup = currentCall;
      console.log(`DashboardPage: Hanging up current call. Call ID: ${callToHangup.id}, State: ${callToHangup.state}`);
      try {
        callToHangup.hangup();
      } catch (e) {
        console.warn(`DashboardPage: Error hanging up current call (ID: ${callToHangup.id}):`, e);
        handleCallEnd(callToHangup, 'hangup');
      }
    } else {
      console.log("DashboardPage: Hangup called but no current call or incoming call to hangup. Resetting state.");
      resetCallVisualState(); 
    }
  }, [currentCall, isReceivingCall, incomingCallDetails, toast, addCallToLog, resetCallVisualState, handleCallEnd]);


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
      console.warn("DashboardPage: Mute toggle called but no active/held call or call state is not conducive. Current callState:", callState);
    }
  };

  const handleHoldToggle = () => {
    if (currentCall && callState === 'active') {
      console.log(`DashboardPage: Putting call on hold. Call ID: ${currentCall.id}`);
      currentCall.hold().then(() => {
        setIsOnHold(true); 
        toast({ title: "Call on Hold" });
      }).catch(err => {
        console.error("DashboardPage: Error putting call on hold:", err);
        toast({ title: "Hold Error", description: "Could not put call on hold.", variant: "destructive" });
      });
    } else if (currentCall && callState === 'held') {
      console.log(`DashboardPage: Resuming call from hold. Call ID: ${currentCall.id}`);
      currentCall.unhold().then(() => {
        setIsOnHold(false); 
        toast({ title: "Call Resumed" });
      }).catch(err => {
        console.error("DashboardPage: Error resuming call from hold:", err);
        toast({ title: "Resume Error", description: "Could not resume call.", variant: "destructive" });
      });
    } else {
       console.warn("DashboardPage: Hold toggle called but no active/held call or call state is not conducive. Current callState:", callState);
    }
  };
  
  const handleAnswerIncomingCall = () => {
    if (isReceivingCall && incomingCallDetails?.call) {
      const callToAnswer = incomingCallDetails.call;
      console.log(`DashboardPage: Answering incoming call from ${incomingCallDetails.callerNumber}. Call ID: ${callToAnswer.id}`);
      try {
        callToAnswer.answer();
        setIsReceivingCall(false); 
        setIncomingCallDetails(null); 
        toast({ title: "Call Answered", description: `Connecting to ${incomingCallDetails.callerName || incomingCallDetails.callerNumber}` });
      } catch (e) {
        console.error("DashboardPage: Error answering incoming call:", e);
        toast({ title: "Answer Error", description: "Could not answer call.", variant: "destructive" });
        setIsReceivingCall(false);
        setIncomingCallDetails(null);
        setCurrentCall(null);
        resetCallVisualState();
      }
    } else {
      console.warn("DashboardPage: Answer called but no active incoming call details found.");
    }
  };

  const handleSendDtmf = (digit: string) => {
    if (currentCall && callState === 'active') {
      console.log(`DashboardPage: Sending DTMF digit: ${digit} for call ID: ${currentCall.id}`);
      try {
        currentCall.dtmf(digit);
        toast({ title: `DTMF Sent: ${digit}`, duration: 2000 });
      } catch (e) {
        console.error("DashboardPage: Error sending DTMF:", e);
        toast({ title: "DTMF Error", description: "Could not send DTMF tone.", variant: "destructive"});
      }
    } else {
      console.warn("DashboardPage: Send DTMF called but no active call. Call state:", callState);
      toast({ title: "DTMF Error", description: "No active call to send DTMF.", variant: "destructive" });
    }
  };

  const dialpadDisabled = !(callState === 'connected') || !!currentCall || isReceivingCall || isCallerIdNeeded;

  if (isCallerIdNeeded && callState !== 'connected' && callState !== 'connecting') { 
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-6 mt-10">
        <Card className="w-full shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center font-headline flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive mr-2" /> Configure Caller ID
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please enter your Telnyx Caller ID number (e.g., +15551234567) to enable calling features.
              This will be stored locally in your browser.
            </p>
            <div>
              <Label htmlFor="callerIdInput" className="mb-1 block">Caller ID Number</Label>
              <Input 
                id="callerIdInput"
                type="tel"
                value={callerIdInput}
                onChange={(e) => setCallerIdInput(e.target.value)}
                placeholder="+12345678900"
                className="text-lg"
              />
            </div>
            <Button onClick={handleSaveCallerId} className="w-full bg-primary hover:bg-primary/90">
              <Save className="mr-2 h-5 w-5" /> Save Caller ID
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        onSendDtmf={handleSendDtmf}
      />
      
      { (callState === 'connected' || callState === 'idle' || callState === 'hangup' || callState === 'destroy' || callState === 'disconnected') && 
        !currentCall && 
        !isReceivingCall &&
        !isCallerIdNeeded && 
        <Dialpad
          currentNumber={currentDialNumber}
          onNumberChange={setCurrentDialNumber}
          onMakeCall={handleMakeCall}
          disabled={dialpadDisabled || callState === 'connecting'}
        />
      }
      
      <CallHistory callLog={callLog} />
    </div>
  );
}

