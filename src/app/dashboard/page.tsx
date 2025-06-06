
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
  const [callState, setCallState] = useState<CallState>('disconnected'); // Default to disconnected
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
  const callStartTimeRef = useRef<number | null>(null);


  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCallDetails, setIncomingCallDetails] = useState<{ call: TelnyxCall; callerNumber: string; callerName?: string } | null>(null);

  const [callerIdInput, setCallerIdInput] = useState<string>('');
  const [callerId, setCallerId] = useState<string | null>(null);
  const [isCallerIdNeeded, setIsCallerIdNeeded] = useState<boolean>(true); 

  const addCallToLog = useCallback((entry: Omit<CallLogEntry, 'id' | 'durationInSeconds'> & { durationInSeconds?: number }) => {
    const currentCallStartTime = callStartTimeRef.current;
    const duration = entry.durationInSeconds ?? (currentCallStartTime ? Math.floor((Date.now() - currentCallStartTime) / 1000) : 0);
    const finalEntry: CallLogEntry = {
      ...entry,
      id: uuidv4(),
      durationInSeconds: duration,
    };
    console.log("DashboardPage: Adding call to log:", finalEntry);
    setCallLog(prevLog => [finalEntry, ...prevLog.slice(0, 49)]);
  }, []);


  const resetCallVisualState = useCallback(() => {
    console.log("DashboardPage: Resetting call visual state.");
    setCname(undefined);
    setIsMuted(false);
    setIsOnHold(false);
    callStartTimeRef.current = null;
    setCallStartTime(null);
    setActiveCallNumber(undefined);
    setIsReceivingCall(false);
    setIncomingCallDetails(null);

    if (telnyxClient && callState === 'connected') { // Check against current state, not client.isConnected
        // Do not change callState here if client is meant to be connected
    } else if (isCallerIdNeeded) {
        setCallState('disconnected'); 
    } else if (telnyxClient) { 
        setCallState('disconnected');
    } else { 
        setCallState('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCallerIdNeeded, callState, setCallState, setCname, setIsMuted, setIsOnHold, setCallStartTime, setActiveCallNumber, setIsReceivingCall, setIncomingCallDetails]);


  const handleCallEnd = useCallback((callEnded: TelnyxCall, finalState: CallState) => {
    console.log(`DashboardPage: Handling call end for call ${callEnded.id}, final state: ${finalState}`);
    const numberForLog = callEnded.remoteCallerNumber || callEnded.options.destinationNumber || "Unknown";
    const cnameForLog = callEnded.remoteCallerName || undefined;

    const currentCallStartTimeVal = callStartTimeRef.current;
    // More reliable check if call was answered/active for logging
    const wasActiveOrAnswered = ['active', 'answering', 'early'].includes(callEnded.state as string) || 
                               ['active', 'answering', 'early'].includes(callEnded.prevState as string) ||
                               currentCallStartTimeVal;


    const callTypeForLog: CallLogEntry['type'] = callEnded.direction === 'inbound'
      ? (wasActiveOrAnswered ? 'incoming' : 'missed')
      : 'outgoing';

    const duration = currentCallStartTimeVal ? Math.floor((Date.now() - currentCallStartTimeVal) / 1000) : 0;

    if (wasActiveOrAnswered || callTypeForLog === 'missed' || (callEnded.direction === 'outgoing' && finalState !== 'new' && finalState !== 'trying' && finalState !== 'requesting')) {
      addCallToLog({
        phoneNumber: numberForLog,
        cname: cnameForLog,
        type: callTypeForLog,
        startTime: currentCallStartTimeVal || Date.now(),
        durationInSeconds: duration,
        status: finalState
      });
    } else {
      console.log(`DashboardPage: Call ${callEnded.id} not logged. Was active/answered indicator: ${wasActiveOrAnswered}, Type: ${callTypeForLog}, Final State: ${finalState}`);
    }

    if (remoteAudioRef.current) {
      console.log(`DashboardPage: Clearing remote audio stream for call ${callEnded.id}.`);
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.load(); // Ensure stream is fully cleared
    }
    
    setCurrentCall(prevCall => {
        if (prevCall && prevCall.id === callEnded.id) {
            console.log(`DashboardPage: Clearing currentCall (ID: ${callEnded.id}) due to call end.`);
            return null;
        }
        console.warn(`DashboardPage: Ended call (ID: ${callEnded.id}) is different from currentCall in state (ID: ${prevCall?.id}). Proceeding with UI reset.`);
        return prevCall;
    });
    resetCallVisualState(); 
    // After resetting visual state, explicitly set callState based on Telnyx client's overall status
    if (telnyxClient) { // If telnyxClient instance still exists (wasn't nulled by disconnect)
        setCallState('connected'); // Assume it should revert to connected if it's still valid
    } else {
        setCallState('disconnected'); // Otherwise, it's disconnected
    }
  }, [addCallToLog, resetCallVisualState, telnyxClient, setCallState]);


  const attachCallListeners = useCallback((call: TelnyxCall) => {
    console.log(`DashboardPage: Attaching listeners to call ID: ${call.id}, direction: ${call.direction}`);
    call.on('telnyx.stream', (streamEvent: any) => {
      console.log(`DashboardPage: telnyx.stream event for call ${call.id}. Attaching to remoteAudio element. Stream:`, streamEvent.stream);
      if (remoteAudioRef.current && streamEvent.stream) {
        remoteAudioRef.current.srcObject = streamEvent.stream;
      } else {
        console.error(`DashboardPage: remoteAudioRef.current is null or stream is missing. Cannot play remote stream for call ${call.id}. Stream:`, streamEvent.stream);
      }
    });

    call.on('telnyx.stateChange', (stateChangeEvent: { state: string; prevState: string }) => {
      const telnyxInternalState = stateChangeEvent.state;
      console.log(`DashboardPage: telnyx.stateChange for call ${call.id}. Telnyx state: ${telnyxInternalState} (prev: ${stateChangeEvent.prevState})`);
      
      // Map Telnyx's internal state to our application's CallState
      let newUiState: CallState;
      switch (telnyxInternalState) {
        case 'new': newUiState = 'new'; break;
        case 'trying': newUiState = 'trying'; break;
        case 'requesting': newUiState = 'requesting'; break;
        case 'recovering': newUiState = 'recovering'; break;
        case 'ringing': newUiState = 'ringing'; break;
        case 'answering': newUiState = 'answering'; break;
        case 'early': newUiState = 'early'; break;
        case 'active': newUiState = 'active'; break;
        case 'held': newUiState = 'held'; break;
        case 'hangup': newUiState = 'hangup'; break;
        case 'destroy': newUiState = 'destroy'; break;
        default:
          console.warn(`DashboardPage: Unmapped Telnyx call state: ${telnyxInternalState}`);
          newUiState = call.state as CallState; // Fallback, might need adjustment
      }
      
      setCallState(newUiState);
      setCname(call.remoteCallerName || undefined);
      setActiveCallNumber(call.remoteCallerNumber || call.options.destinationNumber);

      if (newUiState === 'active' && !callStartTimeRef.current) {
        console.log(`DashboardPage: Call ${call.id} became active. Setting callStartTime.`);
        const now = Date.now();
        callStartTimeRef.current = now;
        setCallStartTime(now);
      }

      if (newUiState === 'hangup' || newUiState === 'destroy') {
        console.log(`DashboardPage: Call ${call.id} ended with state ${newUiState}. Triggering handleCallEnd.`);
        handleCallEnd(call, newUiState);
      }
    });

    call.on('hangup', (params: any) => {
      console.log(`DashboardPage: Explicit Call hangup event for call ${call.id}:`, params);
      handleCallEnd(call, 'hangup');
    });

    call.on('destroy', () => {
      console.log(`DashboardPage: Explicit Call destroy event for call ${call.id}`);
      handleCallEnd(call, 'destroy');
    });

    call.on('error', (error: any) => {
      console.error(`DashboardPage: Call Error for call ${call.id}:`, error);
      toast({ title: "Call Error", description: error.message || "An error occurred during the call.", variant: "destructive", duration: 10000 });
      handleCallEnd(call, 'hangup'); // Treat call errors as hangups for cleanup
    });
  }, [toast, handleCallEnd, setCallState, setCname, setActiveCallNumber, setCallStartTime]);

  // Effect to load callerId from localStorage on initial mount
  useEffect(() => {
    const storedCallerId = typeof window !== 'undefined' ? window.localStorage.getItem(CALLER_ID_STORAGE_KEY) : null;
    if (storedCallerId) {
      console.log("DashboardPage: Initial mount - Found Caller ID in localStorage:", storedCallerId);
      setCallerId(storedCallerId);
      setCallerIdInput(storedCallerId);
      setIsCallerIdNeeded(false);
    } else {
      console.warn("DashboardPage: Initial mount - Caller ID not found in localStorage. User input required.");
      setIsCallerIdNeeded(true);
      setCallState('disconnected'); // Ensure state reflects need for CID
    }
  }, []);


  // Effect for initializing Telnyx client
  useEffect(() => {
    console.log("DashboardPage: Main useEffect for Telnyx client setup triggered. Current callerId state:", callerId);

    const audioEl = document.getElementById('remoteAudio') as HTMLAudioElement;
    if (audioEl) {
      remoteAudioRef.current = audioEl;
    } else {
      console.error("DashboardPage: Remote audio element not found");
      toast({ title: "Audio Error", description: "Could not find audio output element.", variant: "destructive", duration: 10000 });
    }

    if (!callerId) { // If callerId is null or empty (not set yet)
        console.warn("DashboardPage: Caller ID not set. User input required. Aborting Telnyx client setup.");
        setIsCallerIdNeeded(true); // Explicitly set this to true
        setCallState('disconnected'); 
        if (!getCookieValue('telnyx_sip_username') || !getCookieValue('telnyx_sip_password')) {
             toast({ title: "Configuration Needed", description: "Please login and set your Caller ID.", variant: "destructive", duration: 10000 });
        } else {
            // toast({ title: "Configuration Needed", description: "Please set your Caller ID to enable calling features.", variant: "destructive", duration: 10000 });
        }
        return; 
    }
    // If we reach here, callerId is set, so isCallerIdNeeded should be false.
    setIsCallerIdNeeded(false);

    const sipUsernameFromCookie = getCookieValue('telnyx_sip_username');
    const sipPasswordFromCookie = getCookieValue('telnyx_sip_password');

    console.log("DashboardPage: Attempting to retrieve SIP credentials from cookies.");
    console.log("DashboardPage: SIP Username from cookie:", sipUsernameFromCookie ? "**** (present)" : "NOT FOUND");


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
    
    console.log(`DashboardPage: Initializing TelnyxRTC client with SIP Username: ${sipUsernameFromCookie} and Caller ID: ${callerId}`);
    if (TelnyxRTC.version) {
      console.log(`SDK version: ${TelnyxRTC.version || 'N/A'}`);
    }

    const client = new TelnyxRTC({
      login: sipUsernameFromCookie,
      password: sipPasswordFromCookie,
    });
    console.log("DashboardPage: TelnyxRTC client instance created. Current callState before connect:", callState, "Client session ID:", client.sessionid);
    setCallState('connecting');

    const handleTelnyxReady = () => {
      console.log('Telnyx Client Ready! Client Object:', client);
      console.log('Telnyx Client Ready! client.isConnected property value:', (client as any).isConnected); // Diagnostic log
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
      setTelnyxClient(null);
    };

    const handleTelnyxSocketClose = (event: any) => {
      console.warn('Telnyx Socket Closed:', event);
      toast({ title: "Telnyx Disconnected", description: "Connection to Telnyx lost.", variant: "destructive", duration: 10000 });
      setCallState('disconnected');
      setTelnyxClient(null);
    };

    const handleTelnyxNotification = (notification: any) => {
      console.log('Telnyx Notification:', notification);
      if (notification.type === 'callUpdate' && notification.call) {
        const call = notification.call as TelnyxCall;
        
        if (call.state === 'ringing' && call.direction === 'inbound') {
          if (currentCall || isReceivingCall) {
            console.warn("DashboardPage: Incoming call received while another call is active or ringing. Rejecting new call.");
            try {
              call.hangup({ cause: 'USER_BUSY', causeCode: 486 });
            } catch (e) {
              console.warn("DashboardPage: Failed to hangup new incoming call (USER_BUSY may not be supported by SDK version/config):", e);
              try { call.hangup(); } catch (e2) { console.error("Fallback hangup failed:", e2); }
            }
            toast({ title: "Call Rejected", description: "Another call is already in progress or ringing.", variant: "destructive" });
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
        } else if (notification.call && currentCall && notification.call.id === currentCall.id) {
            // Let attachCallListeners handle state changes for the current call
        } else if (notification.call && !currentCall && call.state !== 'ringing'){
            console.log("DashboardPage: Received callUpdate for non-current, non-ringing call. ID:", call.id, "State:", call.state);
        }

      } else if (notification.type === 'userMediaError') {
        console.error("Telnyx User Media Error:", notification.error);
        toast({ title: "Media Error", description: notification.error?.message || "Could not access microphone/camera.", variant: "destructive", duration: 10000 });
      }
    };

    console.log("DashboardPage: Attaching Telnyx client event listeners to client ID:", client.sessionid);
    client.on('telnyx.ready', handleTelnyxReady);
    client.on('telnyx.error', handleTelnyxError);
    client.on('telnyx.socket.close', handleTelnyxSocketClose);
    client.on('telnyx.notification', handleTelnyxNotification);

    console.log("DashboardPage: Calling client.connect() for client ID:", client.sessionid);
    try {
      client.connect();
    } catch (e) {
      console.error("DashboardPage: Error thrown synchronously from client.connect():", e);
      handleTelnyxError(e); 
    }

    return () => {
      console.log("DashboardPage: useEffect (Telnyx client setup) cleanup for client ID:", client.sessionid, ". Disconnecting Telnyx client and removing listeners.");
      client.off('telnyx.ready', handleTelnyxReady);
      client.off('telnyx.error', handleTelnyxError);
      client.off('telnyx.socket.close', handleTelnyxSocketClose);
      client.off('telnyx.notification', handleTelnyxNotification);
      try {
        console.log("DashboardPage: Cleanup - Attempting to disconnect client instance:", client.sessionid);
        client.disconnect();
      } catch (e) {
        console.warn("DashboardPage: Error during client.disconnect() in cleanup:", e);
      }
      
      setTelnyxClient(prevClient => {
        if (prevClient && prevClient.sessionid === client.sessionid) {
          console.log("DashboardPage: Cleanup - Nullifying telnyxClient state for client ID:", client.sessionid);
          return null;
        }
        return prevClient;
      });

      setCurrentCall(prevCurrentCall => {
        if (prevCurrentCall && (prevCurrentCall as any).client === client) { 
            console.log("DashboardPage: Cleanup - Hanging up and nullifying currentCall for client ID:", client.sessionid);
            try { prevCurrentCall.hangup(); } catch(e) {/*ignore errors during cleanup hangup*/}
            return null;
        }
        return prevCurrentCall;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [callerId, toast, attachCallListeners]); 


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


  const handleMakeCall = useCallback(async (numberToCall: string) => {
    console.log(`DashboardPage: Attempting to make call to ${numberToCall}. Current callState: ${callState}, Telnyx client: ${telnyxClient ? 'exists' : 'null'}`);
    if (!telnyxClient || callState !== 'connected') { // Changed condition here
      console.warn("DashboardPage: Cannot make call. Telnyx client is not connected or available.");
      toast({ title: "Not Connected", description: "Telnyx client is not connected. Please check connection, credentials, and Caller ID.", variant: "destructive", duration: 10000 });
      if (callState !== 'connected') setCallState('disconnected'); // Ensure UI reflects disconnected if state was something else
      return;
    }
    if (currentCall || isReceivingCall) {
      console.warn("DashboardPage: Cannot make call. Another call is in progress or ringing.");
      toast({ title: "Call In Progress", description: "Please end the current call or handle the incoming call.", variant: "destructive", duration: 7000 });
      return;
    }

    const effectiveCallerIdForCall = callerId;
    if (!effectiveCallerIdForCall) {
      console.warn("DashboardPage: Cannot make call. Caller ID is not set.");
      toast({ title: "Caller ID Missing", description: "Please set your Caller ID before making a call.", variant: "destructive", duration: 10000 });
      setIsCallerIdNeeded(true);
      return;
    }

    console.log(`DashboardPage: Creating new Telnyx call to ${numberToCall} from ${effectiveCallerIdForCall}.`);
    try {
      const newCall = telnyxClient.newCall({
        destinationNumber: numberToCall,
        callerNumber: effectiveCallerIdForCall,
        callerName: "WebRTC Talk App",
      });

      setCurrentCall(newCall);
      attachCallListeners(newCall);
      setActiveCallNumber(numberToCall);
      setCallState('new'); 
      console.log(`DashboardPage: New call object created (ID: ${newCall.id}). Call state: 'new'.`);
      const now = Date.now();
      callStartTimeRef.current = now;
      setCallStartTime(now);
    } catch (error) {
        console.error("DashboardPage: Error creating new call:", error);
        toast({title: "Call Initiation Error", description: (error as Error).message || "Could not start call.", variant: "destructive"});
        resetCallVisualState(); 
    }

  }, [telnyxClient, currentCall, isReceivingCall, toast, attachCallListeners, callState, callerId, setIsCallerIdNeeded, resetCallVisualState, setCallState]);


  const handleHangup = useCallback(() => {
    if (isReceivingCall && incomingCallDetails?.call) {
      const callToDecline = incomingCallDetails.call;
      console.log(`DashboardPage: Declining incoming call from ${incomingCallDetails.callerNumber}. Call ID: ${callToDecline.id}`);
      try {
        callToDecline.hangup();
      } catch (e) {
        console.warn("DashboardPage: Error declining incoming call:", e);
        handleCallEnd(callToDecline, 'hangup'); // Ensure cleanup if hangup throws
      }
      // Toast and logging handled by handleCallEnd or state changes
      // setIsReceivingCall(false);
      // setIncomingCallDetails(null);
      // setCurrentCall(null); // Will be handled by handleCallEnd
      // resetCallVisualState(); // Will be handled by handleCallEnd
      return;
    }

    if (currentCall) {
      const callToHangup = currentCall;
      console.log(`DashboardPage: Hanging up current call. Call ID: ${callToHangup.id}, State: ${callToHangup.state}`);
      try {
        callToHangup.hangup();
      } catch (e) {
        console.warn(`DashboardPage: Error hanging up current call (ID: ${callToHangup.id}):`, e);
        handleCallEnd(callToHangup, 'hangup'); // Ensure cleanup if hangup throws
      }
    } else {
      console.log("DashboardPage: Hangup called but no current call or incoming call to hangup. Resetting state if needed.");
      resetCallVisualState(); 
    }
  }, [currentCall, isReceivingCall, incomingCallDetails, addCallToLog, resetCallVisualState, handleCallEnd]);


  const handleMuteToggle = useCallback(() => {
    if (currentCall && (currentCall.state === 'active' || currentCall.state === 'held')) {
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
      console.warn("DashboardPage: Mute toggle called but no active/held call. Current call state:", currentCall?.state);
    }
  }, [currentCall, isMuted, toast]);

  const handleHoldToggle = useCallback(() => {
    if (currentCall && currentCall.state === 'active') {
      console.log(`DashboardPage: Putting call on hold. Call ID: ${currentCall.id}`);
      currentCall.hold().then(() => {
        toast({ title: "Call on Hold" });
      }).catch(err => {
        console.error("DashboardPage: Error putting call on hold:", err);
        toast({ title: "Hold Error", description: "Could not put call on hold.", variant: "destructive" });
      });
    } else if (currentCall && currentCall.state === 'held') {
      console.log(`DashboardPage: Resuming call from hold. Call ID: ${currentCall.id}`);
      currentCall.unhold().then(() => {
        toast({ title: "Call Resumed" });
      }).catch(err => {
        console.error("DashboardPage: Error resuming call from hold:", err);
        toast({ title: "Resume Error", description: "Could not resume call.", variant: "destructive" });
      });
    } else {
      console.warn("DashboardPage: Hold toggle called but no active/held call. Current call state:", currentCall?.state);
    }
  }, [currentCall, toast]);

  const handleAnswerIncomingCall = useCallback(() => {
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
  }, [isReceivingCall, incomingCallDetails, toast, resetCallVisualState]);

  const handleSendDtmf = useCallback((digit: string) => {
    if (currentCall && currentCall.state === 'active') {
      console.log(`DashboardPage: Sending DTMF digit: ${digit} for call ID: ${currentCall.id}`);
      try {
        currentCall.dtmf(digit);
        toast({ title: `DTMF Sent: ${digit}`, duration: 2000 });
      } catch (e) {
        console.error("DashboardPage: Error sending DTMF:", e);
        toast({ title: "DTMF Error", description: "Could not send DTMF tone.", variant: "destructive" });
      }
    } else {
      console.warn("DashboardPage: Send DTMF called but no active call. Call state:", currentCall?.state);
      toast({ title: "DTMF Error", description: "No active call to send DTMF.", variant: "destructive" });
    }
  }, [currentCall, toast]);

  const dialpadDisabled = callState !== 'connected' || !!currentCall || isReceivingCall || isCallerIdNeeded;

  if (isCallerIdNeeded && !callerId) { 
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
        currentNumber={activeCallNumber || (isReceivingCall && incomingCallDetails ? incomingCallDetails.callerNumber : currentDialNumber)}
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
        (!isCallerIdNeeded || !!callerId) && 
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
    

    