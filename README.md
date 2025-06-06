
# WebRTC Talk - A Telnyx WebRTC Next.js Demo

This is a Next.js application demonstrating how to integrate the Telnyx WebRTC SDK to build a web-based calling application. It allows users to make and receive calls using their Telnyx SIP Connections.

## For End Users

Welcome to WebRTC Talk! This application lets you make voice calls directly from your web browser using your Telnyx account.

### Getting Started

1.  **Accessing the App**: Open the application URL provided to you in your web browser. You will typically be directed to the login page first.
2.  **Logging In**:
    *   To use the application, you will need your **Telnyx SIP Connection Username** and **Password**. These are specific credentials for your SIP Connection, which you can find or create in your Telnyx Mission Control Portal.
    *   Enter these credentials into the login form on the application's login page.
    *   Click the "Sign In" button.
3.  **Setting Your Caller ID (First Time / If Not Set)**:
    *   After successfully logging in, you will be taken to the Dashboard.
    *   If this is your first time using the app on this browser, or if your Caller ID hasn't been set yet, you will see a prompt to "Configure Caller ID".
    *   Enter your **Telnyx phone number** that you want to use as your Caller ID for outgoing calls. This number must be associated with your Telnyx account and should be entered in E.164 format (e.g., `+15551234567`).
    *   Click "Save Caller ID". This information will be saved in your browser's local storage for future sessions, so you don't have to enter it every time.
4.  **Making Calls**:
    *   Once your Caller ID is set and the Telnyx client is connected (you should see a "Telnyx Connected" message or an "Idle" status in the Call Status display), you can use the dialpad.
    *   Enter the full phone number (e.g., `+15557890123`) or SIP URI (e.g., `sip:user@domain.com`) you wish to call into the dialpad input field.
    *   Click the green "Call" button.
5.  **Receiving Calls**:
    *   If someone calls your Telnyx number that is associated with the SIP Connection you logged in with, an "Incoming Call" alert will appear on your screen.
    *   The alert will show the caller's number and name (if available).
    *   You can choose to "Answer" the call by clicking the green answer button or "Decline" the call by clicking the red decline button.
6.  **During a Call**:
    *   **Mute/Unmute**: Click the microphone icon to mute or unmute your audio.
    *   **Hold/Resume**: Click the pause icon to put the call on hold. Click the play icon (which appears when a call is on hold) to resume the call.
    *   **Hang Up**: Click the red phone icon to end the active call.
7.  **Call History**:
    *   Your recent calls (incoming, outgoing, missed) along with their duration and time will be listed in the "Call History" section on the dashboard.
8.  **Logging Out**:
    *   Click the "Logout" button, usually found in the header of the application, to end your session. This will clear your SIP credentials from the browser's cookies.

### Troubleshooting Tips
*   **Cannot Connect to Telnyx / "Telnyx Error" / "Disconnected" Status**:
    *   Double-check that the SIP Username and Password you entered during login are correct.
    *   Ensure the Caller ID you saved on the dashboard is a valid Telnyx number associated with your account and is in the correct E.164 format (e.g., `+12345678900`).
    *   Verify your internet connection is stable.
    *   Check the browser's developer console (usually F12) for more specific error messages from the Telnyx SDK.
*   **No Audio**:
    *   Ensure your microphone is enabled in your browser settings and that you've granted the website permission to access your microphone.
    *   Check your computer's system audio input/output settings.
*   **"Configuration Needed" Toast**: This means either your SIP credentials weren't found (try logging in again) or your Caller ID isn't set (follow step 3).

---

## For Developers

This project serves as a reference for integrating Telnyx WebRTC into a Next.js application using React, Tailwind CSS, and ShadCN UI components.

### Prerequisites

*   Node.js (LTS version recommended)
*   npm or yarn (or your preferred Node.js package manager)
*   A Telnyx account:
    *   An active SIP Connection configured for "Credentials" authentication.
    *   A phone number associated with your Telnyx account to be used as a Caller ID. This number should be capable of making and receiving calls via your SIP Connection.

### Project Setup

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

### Running the Development Server

Execute the following command to start the Next.js development server (powered by Turbopack for speed):
```bash
npm run dev
```
The application will typically be available at `http://localhost:9002`.

### Configuration & Telnyx Integration Details

**1. Telnyx SIP Credentials Handling:**
*   The application requires users to log in with their Telnyx SIP Connection username and password. These are submitted via a form on the `/login` page (`src/app/login/page.tsx` and `src/components/auth/LoginForm.tsx`).
*   The `login` server action, located in `src/lib/actions.ts`, handles the "login" process:
    *   It validates that a username and password are provided using Zod.
    *   Upon successful validation (i.e., fields are not empty), it stores the provided SIP username and password in browser cookies: `telnyx_sip_username` and `telnyx_sip_password`.
    *   These cookies are **not `httpOnly`** because they need to be read by client-side JavaScript in `src/app/dashboard/page.tsx` to initialize the `TelnyxRTC` client.
*   The `logout` server action in `src/lib/actions.ts` clears these cookies.

**2. Caller ID Number Management:**
*   The `CALLER_ID_NUMBER` used for outgoing calls is managed on the client-side within `src/app/dashboard/page.tsx`.
*   If no Caller ID is found in the browser's `localStorage` (under the key `telnyx_caller_id`), the user is prompted to enter and save it via an input field on the dashboard.
*   Once saved, the Caller ID is stored in `localStorage` for persistence across sessions on the same browser.
*   The Telnyx client (`TelnyxRTC`) will only attempt to connect if both SIP credentials (from cookies) and a Caller ID (from `localStorage` or user input) are available.

**3. Telnyx WebRTC SDK (`@telnyx/webrtc`) Integration:**
*   The SDK is primarily initialized and managed in `src/app/dashboard/page.tsx`.
*   **Initialization**: A new `TelnyxRTC` instance is created using the SIP username and password retrieved from cookies.
    ```javascript
    const client = new TelnyxRTC({
      login: sipUsernameFromCookie,
      password: sipPasswordFromCookie,
    });
    ```
*   **Connection**: `client.connect()` is called to establish the connection with Telnyx.
*   **Key Event Listeners**:
    *   `telnyx.ready`: Fired when the client successfully connects to Telnyx. The UI updates to a 'connected' state.
    *   `telnyx.error`: Handles connection errors or other SDK errors. Error messages are logged and displayed via toasts.
    *   `telnyx.socket.close`: Fired when the WebSocket connection to Telnyx is closed. The UI updates to a 'disconnected' state.
    *   `telnyx.notification`: Used to receive various events from Telnyx, most importantly:
        *   `callUpdate`: This event contains the `call` object and is fired for various call state changes. It's used to detect incoming calls (when `call.state === 'ringing'` and `call.direction === 'inbound'`).
        *   `userMediaError`: Indicates an issue accessing the microphone (e.g., permissions denied).
*   **Call Lifecycle Management**:
    *   **Outgoing Calls**: `client.newCall({ destinationNumber, callerNumber, callerName })` is used to initiate calls.
    *   **Incoming Calls**: The `call` object from the `callUpdate` notification is used. `call.answer()` to answer, `call.hangup()` to decline.
    *   **Active Call Controls**: Methods on the `TelnyxCall` object (e.g., `call.hangup()`, `call.muteAudio()`, `call.unmuteAudio()`, `call.hold()`, `call.unhold()`) are used to manage the call state.
*   **Remote Audio**: An `<audio id="remoteAudio" autoPlay playsInline />` element in `src/app/dashboard/layout.tsx` is used. The remote media stream from the call (`call.remoteStream`) is attached to this element's `srcObject` to play the audio from the other party.

### Key Files & Project Structure

*   **`src/app/login/page.tsx`**: The UI for the login page.
*   **`src/components/auth/LoginForm.tsx`**: The React component containing the login form logic and UI.
*   **`src/lib/actions.ts`**: Contains Next.js Server Actions for `login` and `logout`. This includes Zod validation for login input and management of SIP credentials in cookies.
*   **`src/app/dashboard/page.tsx`**: This is the core of the application. It handles:
    *   Retrieving SIP credentials from cookies.
    *   Managing Caller ID input and `localStorage`.
    *   Initializing and connecting the `TelnyxRTC` client.
    *   Handling all Telnyx client and call event listeners.
    *   Managing UI state related to calls (e.g., `callState`, `currentCall`, `isMuted`, `isOnHold`).
    *   Functions for making calls, answering, hanging up, muting, and holding.
    *   Call logging.
*   **`src/app/dashboard/layout.tsx`**: The layout for the authenticated dashboard section. It includes the global header with the logout button and the crucial `<audio id="remoteAudio" />` element for playing remote call audio.
*   **`src/app/dashboard/error.tsx`**: Custom error boundary for the dashboard.
*   **`src/app/dashboard/loading.tsx`**: Custom loading UI for the dashboard.
*   **`src/components/call/`**: Directory containing UI components related to call functionality:
    *   `Dialpad.tsx`: The numerical dialpad for inputting numbers.
    *   `CallDisplay.tsx`: Shows the current call status, connected number/name, and call duration.
    *   `CallControls.tsx`: Buttons for mute, hold, hangup, and answering incoming calls.
    *   `IncomingCallAlert.tsx`: A modal/alert that appears for incoming calls.
*   **`src/components/history/CallHistory.tsx`**: Component to display a log of recent calls.
*   **`src/types/call.ts`**: TypeScript type definitions for `CallState` and `CallLogEntry`.
*   **`src/hooks/use-toast.ts`**: Custom hook for displaying toast notifications using ShadCN's toast components.
*   **`package.json`**: Lists project dependencies, including `@telnyx/webrtc`, and scripts for running the application.
*   **`README.md`**: This file.

### Important Security Note for Developers
Storing SIP credentials directly in client-readable cookies (not `httpOnly`) and relying on client-side `localStorage` for Caller ID is implemented in this demo for simplicity and to facilitate direct client-side SDK initialization with user-provided credentials. **For production applications, this is NOT a recommended security practice due to risks like XSS attacks.**

Consider the following for a more secure production environment:
*   **Backend-for-Frontend (BFF) Pattern**: Implement a secure backend service.
    *   Your application's users would authenticate against this BFF using robust methods (e.g., OAuth 2.0, OIDC).
    *   The BFF would securely store or manage access to Telnyx credentials.
*   **Token-Based Authentication for Telnyx SDK**: This is the **recommended approach by Telnyx** for client-side SDKs.
    *   Your BFF, after authenticating your application's user, would securely obtain a short-lived `login_token` from Telnyx (e.g., using Telnyx API keys server-side via Telnyx API v2).
    *   This `login_token` is then passed to the frontend.
    *   The `TelnyxRTC` client is initialized with this `login_token` instead of the raw SIP username and password:
      ```javascript
      const client = new TelnyxRTC({
        login_token: 'your_fetched_jwt_token'
      });
      ```
*   **Secure Session Management**: Store primary user session identifiers in secure, `httpOnly` cookies managed by your BFF.

### Further Development & Potential Enhancements
This demo provides a foundation. Here are some ideas for further development:
*   **Video Calling**: Extend the application to support video calls using the Telnyx SDK's video capabilities.
*   **Audio Input/Output Device Selection**: Allow users to select their preferred microphone and speaker devices using `client.getAudioInDevices()`, `client.getAudioOutDevices()`, `call.setAudioInDevice()`, and `call.setAudioOutDevice()`.
*   **DTMF (Dial Tones)**: Implement functionality to send DTMF tones during an active call using `call.dtmf('123#*')`.
*   **Advanced Call Control**: Integrate with Telnyx Call Control V2 APIs for more sophisticated server-side call management (e.g., call recording, programmatic call transfers, conferencing).
*   **Pre-Call Diagnostics**: Implement `TelnyxRTC.PreCallDiagnosis.run(...)` to test network quality before initiating a call.
*   **Connection Recovery**: Enhance the logic for automatically retrying connections if the Telnyx WebSocket disconnects.
*   **Presence & User Status**: If building a team application, indicate user availability.
*   **UI/UX Refinements**: Improve visual feedback, animations, and overall user experience.
*   **Robust Backend Authentication**: Fully implement a BFF and token-based authentication for the Telnyx client as described in the security note.
*   **State Management**: For more complex UIs, consider a dedicated state management library (though React Context and `useState`/`useReducer` are used here).
