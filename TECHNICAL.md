
# Technical Documentation: WebRTC Talk

## 1. Introduction

This document provides an in-depth technical explanation of the WebRTC Talk application. It is intended for developers working on or looking to understand the codebase. The application is built using Next.js, React, TypeScript, and integrates the Telnyx WebRTC SDK for its core calling functionalities. UI is built with ShadCN components and styled with Tailwind CSS.

## 2. Core Technologies

*   **Next.js (v15 with App Router)**: Framework for server-rendered React applications.
*   **React (v18)**: JavaScript library for building user interfaces.
*   **TypeScript**: Superset of JavaScript adding static typing.
*   **Telnyx WebRTC SDK (`@telnyx/webrtc`)**: Client-side SDK for handling WebRTC calls via Telnyx.
*   **ShadCN UI**: Collection of re-usable UI components.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Zod**: TypeScript-first schema declaration and validation library, used for form validation.
*   **Lucide React**: Icon library.
*   **UUID**: For generating unique IDs, e.g., for call log entries.

## 3. Project Structure

```
.
├── README.md
├── TECHNICAL.md
├── next.config.ts
├── package.json
├── components.json
├── public/
├── src/
│   ├── app/
│   │   ├── (app)/              # (Obsolete, should be removed if still present)
│   │   ├── dashboard/          # Authenticated area - main application
│   │   │   ├── error.tsx       # Error boundary for dashboard
│   │   │   ├── layout.tsx      # Layout for dashboard (header, audio element)
│   │   │   ├── loading.tsx     # Loading UI for dashboard
│   │   │   └── page.tsx        # Core logic for WebRTC, call management
│   │   ├── login/
│   │   │   └── page.tsx        # Login page UI
│   │   ├── globals.css         # Global styles and Tailwind CSS theme
│   │   ├── layout.tsx          # Root layout for the entire application
│   │   └── page.tsx            # Root page, redirects to /login
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.tsx   # Login form component
│   │   ├── call/
│   │   │   ├── CallControls.tsx # Buttons for mute, hold, hangup, answer
│   │   │   ├── CallDisplay.tsx  # Shows call status, number, duration
│   │   │   ├── Dialpad.tsx      # Numerical dialpad
│   │   │   └── IncomingCallAlert.tsx # Modal for incoming calls
│   │   ├── history/
│   │   │   └── CallHistory.tsx # Displays call log
│   │   └── ui/                 # ShadCN UI components
│   ├── hooks/
│   │   ├── use-mobile.tsx      # (If present, for detecting mobile devices)
│   │   └── use-toast.ts        # Custom hook for ShadCN toast notifications
│   ├── lib/
│   │   ├── actions.ts          # Next.js Server Actions (login, logout)
│   │   └── utils.ts            # Utility functions (e.g., `cn` for Tailwind)
│   └── types/
│       └── call.ts             # TypeScript type definitions for call state, log entries
└── tailwind.config.ts
```

## 4. Authentication Flow

### 4.1. Login Process
1.  **Entry Point**: Users are directed to `/login` (either directly or via redirect from `/`).
2.  **UI**: `src/app/login/page.tsx` renders the `LoginForm` component from `src/components/auth/LoginForm.tsx`.
3.  **Form Submission**: The `LoginForm` uses a standard HTML `<form>` that calls a Next.js Server Action.
4.  **Server Action (`login` in `src/lib/actions.ts`)**:
    *   Receives `FormData`.
    *   Uses `Zod` (`LoginSchema`) to validate that `username` and `password` fields are non-empty.
    *   If validation passes, it stores the provided SIP `username` and `password` in browser cookies:
        *   `telnyx_sip_username`
        *   `telnyx_sip_password`
    *   These cookies are **not `httpOnly`** because they need to be read by client-side JavaScript on the `/dashboard` page to initialize the `TelnyxRTC` client.
    *   Redirects the user to `/dashboard` upon successful "login" (i.e., validation passed).
5.  **Error Handling**: If Zod validation fails, errors are returned to the `LoginForm` component and displayed.

### 4.2. Logout Process
1.  **Trigger**: The "Logout" button in the `src/app/dashboard/layout.tsx` header submits a form that calls the `logout` Server Action.
2.  **Server Action (`logout` in `src/lib/actions.ts`)**:
    *   Clears the `telnyx_sip_username` and `telnyx_sip_password` cookies.
    *   Redirects the user to `/login`.

### 4.3. Accessing the Dashboard
*   The `/dashboard` route is the main authenticated area.
*   `src/app/dashboard/page.tsx` attempts to retrieve SIP credentials from cookies upon loading.
*   If credentials are not found, it redirects the user to `/login` using `window.location.href`.

## 5. Dashboard & Telnyx WebRTC Integration (`src/app/dashboard/page.tsx`)

This is the most complex part of the application, handling all WebRTC logic.

### 5.1. State Management (React Hooks)
The component relies heavily on `useState` and `useRef` for managing:
*   `currentDialNumber`: Number input from the dialpad.
*   `callState`: Current state of the call/Telnyx client (see `src/types/call.ts`).
*   `cname`: Caller name for display.
*   `isMuted`, `isOnHold`: Boolean flags for call control states.
*   `callLog`: Array of `CallLogEntry` for history.
*   `callStartTime`: Timestamp for calculating call duration.
*   `activeCallNumber`: Number currently involved in the call.
*   `telnyxClient`: Stores the `TelnyxRTC` client instance.
*   `currentCall`: Stores the active `TelnyxCall` object.
*   `remoteAudioRef`: Ref to the `<audio id="remoteAudio">` element for playing remote media.
*   `isReceivingCall`, `incomingCallDetails`: State for managing incoming call alerts.
*   `callerIdInput`, `callerId`: For managing user-input Caller ID.
*   `isCallerIdNeeded`: Flag to prompt for Caller ID if not set.

### 5.2. Initialization & Connection (`useEffect`)
*   **Primary `useEffect` Hook (depends on `callerId`)**:
    *   **Audio Element**: Gets a reference to `<audio id="remoteAudio">`.
    *   **SIP Credentials**: Reads `telnyx_sip_username` and `telnyx_sip_password` from cookies using a helper function `getCookieValue`.
        *   If not found, redirects to `/login`.
    *   **Caller ID**:
        *   Reads `callerId` from `localStorage` (key: `CALLER_ID_STORAGE_KEY`).
        *   If found, sets `callerId` state and `isCallerIdNeeded` to `false`.
        *   If not found, sets `isCallerIdNeeded` to `true`, prompting the user for input. The Telnyx client will not connect until Caller ID is provided.
    *   **Conditional TelnyxRTC Instantiation**:
        *   Only proceeds if SIP credentials AND a `callerId` are available.
        *   Creates `new TelnyxRTC({ login: sipUsername, password: sipPassword })`.
        *   Sets `callState` to `'connecting'`.
    *   **Event Listeners**: Attaches event listeners to the `telnyxClient` instance:
        *   `telnyx.ready`: Client connected successfully. Sets `callState` to `'connected'`, stores the client instance.
        *   `telnyx.error`: Handles connection or SDK errors. Displays a toast, sets `callState` to `'disconnected'`.
        *   `telnyx.socket.close`: WebSocket disconnected. Sets `callState` to `'disconnected'`, clears client instance.
        *   `telnyx.notification`: Handles various notifications:
            *   `callUpdate`: If `call.state === 'ringing'` and `call.direction === 'inbound'`, it triggers the incoming call UI. It also updates `currentCall` and attaches call-specific listeners.
            *   `userMediaError`: Handles microphone/camera access errors.
    *   **`client.connect()`**: Initiates the connection to Telnyx.
    *   **Cleanup Function**: On component unmount or when `callerId` changes:
        *   Removes all attached Telnyx client event listeners (`client.off(...)`).
        *   Calls `client.disconnect()` if the client is connected.
        *   Clears `telnyxClient` state.
        *   Hangs up `currentCall` if one exists.

### 5.3. Caller ID Management
*   **Input**: If `isCallerIdNeeded` is true, an input field and "Save Caller ID" button are shown.
*   **`handleSaveCallerId`**:
    *   Trims and formats the input (prepends `+` if missing).
    *   Saves to `localStorage` under `CALLER_ID_STORAGE_KEY`.
    *   Updates `callerId` state, sets `isCallerIdNeeded` to `false`.
    *   Resets `callState` to allow Telnyx client to re-attempt connection with the new Caller ID.

### 5.4. Call Lifecycle
*   **`attachCallListeners(call: TelnyxCall)`**:
    *   Called when a new call object is created (outgoing) or received (incoming).
    *   `call.on('telnyx.stream', ...)`: Attaches the `call.remoteStream` to `remoteAudioRef.current.srcObject` to play remote audio.
    *   `call.on('telnyx.stateChange', ...)`: Maps Telnyx's internal call states (e.g., `TelnyxRTC.VERTO_STATES.ACTIVE`) to the application's `CallState` enum. Updates UI elements like `cname`, `activeCallNumber`. Sets `callStartTime` when a call becomes active. Calls `handleCallEnd` on `hangup` or `destroy`.
    *   `call.on('hangup', ...)` and `call.on('destroy', ...)`: Call `handleCallEnd`.
    *   `call.on('error', ...)`: Handles call-specific errors.
*   **`handleMakeCall(numberToCall: string)`**:
    *   Checks if `telnyxClient` is connected and `callerId` is set.
    *   Calls `telnyxClient.newCall({ destinationNumber, callerNumber: callerId, callerName: "WebRTC Talk App" })`.
    *   Sets `currentCall` to the new call object.
    *   Calls `attachCallListeners` for the new call.
    *   Sets `callStartTime`.
*   **`handleAnswerIncomingCall()`**:
    *   Called when the user clicks "Answer" on the `IncomingCallAlert`.
    *   Calls `incomingCallDetails.call.answer()`.
    *   Updates UI state.
*   **`handleHangup()`**:
    *   If an incoming call is ringing (`isReceivingCall`), it declines by calling `incomingCallDetails.call.hangup()`. Logs a missed call.
    *   If an active call exists (`currentCall`), it calls `currentCall.hangup()`.
    *   Resets call-related UI state.
*   **`handleCallEnd(callEnded: TelnyxCall, finalState: CallState)`**:
    *   Logs the call to `callLog` via `addCallToLog`.
    *   Clears `remoteAudioRef.current.srcObject`.
    *   Clears `currentCall`.
    *   Calls `resetCallVisualState`.
*   **`resetCallVisualState()`**: Resets UI elements like `cname`, `isMuted`, `isOnHold`, `callStartTime`, etc., to their default states. Sets `callState` appropriately based on `telnyxClient` connection.

### 5.5. Call Controls
*   **Mute/Unmute (`handleMuteToggle`)**: Calls `currentCall.muteAudio()` or `currentCall.unmuteAudio()`. Updates `isMuted` state.
*   **Hold/Unhold (`handleHoldToggle`)**: Calls `currentCall.hold()` or `currentCall.unhold()`. Updates `isOnHold` state. Note: `hold()` and `unhold()` are asynchronous.

### 5.6. Call Logging (`addCallToLog`, `CallHistory.tsx`)
*   `addCallToLog`: Creates a `CallLogEntry` object with details like phone number, type, start time, duration, and status. Prepends it to the `callLog` state array. Uses `uuidv4` for unique IDs.
*   `CallHistory.tsx`: Renders the `callLog` in a table format.

## 6. Key UI Components

*   **`src/components/auth/LoginForm.tsx`**: Standard form using `useActionState` for handling server action responses.
*   **`src/components/call/Dialpad.tsx`**: Renders a numerical dialpad. Manages number input and triggers `onMakeCall`.
*   **`src/components/call/CallDisplay.tsx`**: Displays current `callState` (e.g., "Active Call", "Ringing..."), connected number/name, and call duration (updates via `useEffect` and a timer).
*   **`src/components/call/CallControls.tsx`**: Provides buttons for Mute, Hold, Hangup, and Answer (conditionally). Button availability/state depends on the current `callState`.
*   **`src/components/call/IncomingCallAlert.tsx`**: A modal dialog that appears for incoming calls, offering Answer/Decline options.
*   **`src/components/history/CallHistory.tsx`**: Renders a scrollable table of past calls from the `callLog` prop.

## 7. Styling

*   **Tailwind CSS**: Used for all styling. Utility classes are applied directly in JSX.
*   **ShadCN UI**: Provides pre-built, styled components (Button, Card, Input, etc.).
*   **`src/app/globals.css`**: Defines the Tailwind CSS layers and custom HSL CSS variables for theming (background, foreground, primary, accent, etc.). This allows for consistent color schemes.

## 8. Type Definitions (`src/types/call.ts`)

*   **`CallState`**: An enum-like type defining the various states the application can be in regarding the Telnyx client connection and active calls. This helps manage UI changes based on call status.
*   **`CallLogEntry`**: Defines the structure for objects stored in the call history.

## 9. Security Considerations

*   **Client-Side SIP Credentials**: Storing SIP credentials (username, password) in client-readable cookies and relying on `localStorage` for Caller ID is convenient for development and this demo but is **not recommended for production**. These can be vulnerable to XSS attacks.
*   **Production Recommendations**:
    *   Implement a Backend-for-Frontend (BFF).
    *   Use Telnyx's token-based authentication (`login_token`) for the `TelnyxRTC` client. The BFF would securely generate these short-lived tokens.

## 10. Potential Future Enhancements (from `README.md`)

*   Video Calling.
*   Audio Input/Output Device Selection.
*   DTMF (Dial Tones) during an active call.
*   Advanced Call Control (via Telnyx V2 APIs).
*   Pre-Call Diagnostics (`TelnyxRTC.PreCallDiagnosis.run(...)`).
*   Connection Recovery Logic.
*   Presence & User Status.
*   UI/UX Refinements.
*   Robust Backend Authentication (BFF, token-based).
*   More sophisticated state management if the application grows significantly.

This document should serve as a good reference for understanding the current state and architecture of the WebRTC Talk application.

    