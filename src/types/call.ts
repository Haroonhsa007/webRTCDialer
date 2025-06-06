export type CallState = 
  | 'idle' 
  | 'new'
  | 'trying'
  | 'requesting'
  | 'recovering'
  | 'ringing' 
  | 'answering'
  | 'early'
  | 'active' 
  | 'held'
  | 'hangup'
  | 'destroy'
  | 'purge'
  | 'incoming'; // Custom UI state for incoming call alert

export interface CallLogEntry {
  id: string;
  phoneNumber: string;
  cname?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  startTime: number; // Store as timestamp (Date.now())
  durationInSeconds: number;
  status: CallState; // Final status of the call, e.g., 'active' if completed, 'hangup' if ended, 'missed'
}
