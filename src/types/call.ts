export type CallState = 
  | 'idle'        // Not in a call, client may or may not be connected to Telnyx
  | 'connecting'  // Telnyx client is connecting
  | 'connected'   // Telnyx client connected, ready for calls
  | 'disconnected'// Telnyx client disconnected
  | 'new'         // Call object created, not yet dialed
  | 'trying'      // Call is trying to connect
  | 'requesting'  // Call is requesting media, etc.
  | 'recovering'  // Call is attempting to recover connection
  | 'ringing'     // Call is ringing (either outgoing or incoming)
  | 'answering'   // Call is being answered
  | 'early'       // Early media
  | 'active'      // Call is active, media flowing
  | 'held'        // Call is on hold
  | 'hangup'      // Call has been hung up
  | 'destroy'     // Call object is destroyed
  | 'purge'       // Call is purged
  | 'incoming';   // Custom UI state for incoming call alert / Telnyx call offered

export interface CallLogEntry {
  id: string;
  phoneNumber: string;
  cname?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  startTime: number; // Store as timestamp (Date.now())
  durationInSeconds: number;
  status: CallState; // Final status of the call
}
