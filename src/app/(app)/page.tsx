"use client";

import { useState, useEffect, useCallback } from 'react';
import { Dialpad } from '@/components/call/Dialpad';
import { CallDisplay } from '@/components/call/CallDisplay';
import { CallControls } from '@/components/call/CallControls';
import { CallHistory } from '@/components/history/CallHistory';
import { IncomingCallAlert } from '@/components/call/IncomingCallAlert';
import type { CallState, CallLogEntry } from '@/types/call';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// Helper to simulate Telnyx call states
const callStatesSequence: CallState[] = ['new', 'trying', 'requesting', 'ringing', 'early', 'answering', 'active'];

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

  // Mock incoming call state
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCallerNumber, setIncomingCallerNumber] = useState("18001234567");
  const [incomingCallerName, setIncomingCallerName] = useState("Support Team");

  const addCallToLog = useCallback((entry: Omit<CallLogEntry, 'id' | 'durationInSeconds'> & { durationInSeconds?: number }) => {
    const duration = entry.durationInSeconds ?? (callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0);
    const finalEntry: CallLogEntry = {
      ...entry,
      id: uuidv4(),
      durationInSeconds: duration,
    };
    setCallLog(prevLog => [finalEntry, ...prevLog]);
  }, [callStartTime]);

  const resetCallState = useCallback(() => {
    setCallState('idle');
    setCname(undefined);
    setIsMuted(false);
    setIsOnHold(false);
    setCallStartTime(null);
    setCurrentDialNumber('');
    setActiveCallNumber(undefined);
  }, []);
  
  const handleMakeCall = useCallback((numberToCall: string) => {
    if (callState !== 'idle') {
      toast({ title: "Call In Progress", description: "Please end the current call before starting a new one.", variant: "destructive" });
      return;
    }
    setActiveCallNumber(numberToCall);
    const currentCallStartTime = Date.now();
    setCallStartTime(currentCallStartTime);
    let stateIndex = 0;
    
    const intervalId = setInterval(() => {
      setCallState(callStatesSequence[stateIndex]);
      if (callStatesSequence[stateIndex] === 'active') {
        setCname(Math.random() > 0.5 ? "John Doe" : "Acme Corp"); // Mock CNAME
        clearInterval(intervalId);
      }
      stateIndex++;
      if (stateIndex >= callStatesSequence.length && callStatesSequence[stateIndex-1] !== 'active') { 
        clearInterval(intervalId);
        toast({ title: "Call Failed", description: `Could not connect to ${numberToCall}.`, variant: "destructive" });
        addCallToLog({ phoneNumber: numberToCall, type: 'outgoing', startTime: currentCallStartTime, status: 'hangup' });
        resetCallState();
      }
    }, 1500); // Simulate state transitions

    // Simulate call failure after some time if not active
    const callSetupTimeout = setTimeout(() => {
        if (callState !== 'active' && callState !== 'idle' && callState !== 'hangup') { 
            clearInterval(intervalId);
            toast({ title: "Call Failed", description: `Could not connect to ${numberToCall}.`, variant: "destructive" });
            addCallToLog({ phoneNumber: numberToCall, type: 'outgoing', startTime: currentCallStartTime, status: 'hangup' });
            resetCallState();
        }
    }, 10000 + Math.random() * 5000); // 10-15 seconds timeout for mock call setup

    return () => { // Cleanup function for useCallback
      clearInterval(intervalId);
      clearTimeout(callSetupTimeout);
    };

  }, [callState, toast, addCallToLog, resetCallState]);

  const handleHangup = useCallback(() => {
    if (callState === 'idle' && !isReceivingCall) return; 

    const callTypeForLog: CallLogEntry['type'] = callState === 'incoming' && isReceivingCall ? 'missed' : (activeCallNumber === incomingCallerNumber && cname === incomingCallerName ? 'incoming' : 'outgoing');
    const numberForLog = activeCallNumber || currentDialNumber || (isReceivingCall ? incomingCallerNumber : "Unknown");
    const cnameForLog = cname || (isReceivingCall ? incomingCallerName : undefined);

    if (isReceivingCall) { 
        setIsReceivingCall(false);
        toast({ title: "Call Declined", description: `Incoming call from ${incomingCallerNumber} declined.`});
        addCallToLog({ phoneNumber: incomingCallerNumber, cname: incomingCallerName, type: 'missed', startTime: callStartTime || Date.now(), status: 'hangup' });
        resetCallState(); // Reset since an incoming call was being processed
        return;
    }

    const callDuration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    toast({ title: "Call Ended", description: `Duration: ${callDuration}s` });
    addCallToLog({ 
      phoneNumber: numberForLog, 
      cname: cnameForLog, 
      type: callTypeForLog, 
      startTime: callStartTime || Date.now(), 
      durationInSeconds: callDuration,
      status: 'hangup'
    });
    setCallState('hangup'); 
    setTimeout(() => {
      resetCallState();
    }, 500); 
  }, [callState, isReceivingCall, incomingCallerNumber, incomingCallerName, toast, addCallToLog, callStartTime, activeCallNumber, currentDialNumber, cname, resetCallState]);


  const handleMuteToggle = () => {
    if (callState === 'active' || callState === 'held') {
      setIsMuted(!isMuted);
      toast({ title: isMuted ? "Unmuted" : "Muted" });
    }
  };

  const handleHoldToggle = () => {
    if (callState === 'active') {
      setIsOnHold(true);
      setCallState('held');
      toast({ title: "Call on Hold" });
    } else if (callState === 'held') {
      setIsOnHold(false);
      setCallState('active');
      toast({ title: "Call Resumed" });
    }
  };
  
  const handleAnswerIncomingCall = () => {
    setIsReceivingCall(false); 
    setActiveCallNumber(incomingCallerNumber);
    setCname(incomingCallerName);
    const currentCallStartTime = Date.now();
    setCallStartTime(currentCallStartTime);
    setCallState('active');
    toast({ title: "Call Answered", description: `Connected to ${incomingCallerName || incomingCallerNumber}` });
  };

  useEffect(() => {
    let incomingCallTimeout: NodeJS.Timeout;
    if (callState === 'idle' && !isReceivingCall) {
      incomingCallTimeout = setTimeout(() => {
        setIncomingCallerNumber(`1-800-555-${Math.floor(Math.random()*9000)+1000}`);
        setIncomingCallerName(Math.random() > 0.5 ? "Jane Smith" : "Urgent Support");
        setIsReceivingCall(true);
        setCallState('incoming'); 
      }, Math.random() * 15000 + 15000); // Simulate incoming call after 15-30 seconds of idle
    }
    return () => clearTimeout(incomingCallTimeout);
  }, [callState, isReceivingCall]);


  const dialpadDisabled = callState !== 'idle' && !(callState === 'incoming' && isReceivingCall);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-6">
      {isReceivingCall && callState === 'incoming' && (
        <IncomingCallAlert
          callerNumber={incomingCallerNumber}
          callerName={incomingCallerName}
          onAnswer={handleAnswerIncomingCall}
          onDecline={handleHangup} 
        />
      )}
      
      <CallDisplay 
        callState={callState} 
        cname={cname} 
        currentNumber={callState === 'active' || callState === 'held' ? activeCallNumber : (callState === 'incoming' && isReceivingCall ? incomingCallerNumber : currentDialNumber) }
        callStartTime={callStartTime}
      />

      <CallControls
        callState={callState}
        isMuted={isMuted}
        isOnHold={isOnHold}
        onMuteToggle={handleMuteToggle}
        onHoldToggle={handleHoldToggle}
        onHangup={handleHangup}
        onAnswer={callState === 'incoming' && isReceivingCall ? handleAnswerIncomingCall : undefined}
      />
      
      { (callState === 'idle' && !isReceivingCall) &&
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
