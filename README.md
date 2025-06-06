
# WebRTC Talk - A Telnyx WebRTC Next.js Demo

This is a Next.js application demonstrating how to integrate the Telnyx WebRTC SDK to build a web-based calling application. It allows users to make and receive calls using their Telnyx SIP Connections.

## For End Users

Welcome to WebRTC Talk! This application lets you make voice calls directly from your web browser using your Telnyx account.

### Getting Started

1.  **Accessing the App**: Open the application URL in your web browser. You will be directed to the login page.
2.  **Logging In**:
    *   You will need your **Telnyx SIP Connection Username** and **Password**.
    *   Enter these credentials into the login form.
    *   Click "Sign In".
3.  **Setting Your Caller ID**:
    *   After logging in, you will be taken to the Dashboard.
    *   If this is your first time, or if your Caller ID isn't set, you'll see a prompt to "Configure Caller ID".
    *   Enter your **Telnyx phone number** (in E.164 format, e.g., `+15551234567`) that you want to use as your Caller ID for outgoing calls.
    *   Click "Save Caller ID". This will be saved in your browser for future sessions.
4.  **Making Calls**:
    *   Once your Caller ID is set and the Telnyx client is connected (you should see a "Telnyx Connected" message or an "Idle" status), you can use the dialpad.
    *   Enter the phone number or SIP URI you wish to call.
    *   Click the "Call" button.
5.  **Receiving Calls**:
    *   If someone calls your Telnyx number associated with your SIP Connection, an "Incoming Call" alert will appear.
    *   You can choose to "Answer" or "Decline" the call.
6.  **During a Call**:
    *   You can mute/unmute your microphone.
    *   You can put the call on hold/resume the call.
    *   You can hang up the call.
7.  **Call History**: Your recent calls (incoming, outgoing, missed) will be listed in the "Call History" section.
8.  **Logging Out**: Click the "Logout" button in the header to end your session.

### Troubleshooting
*   **Cannot Connect to Telnyx / "Telnyx Error"**:
    *   Ensure the SIP Username and Password you entered are correct.
    *   Ensure the Caller ID you saved is a valid Telnyx number associated with your account and is in the correct format (e.g., `+12345678900`).
    *   Check your internet connection.
*   **No Audio**: Ensure your microphone is enabled in your browser and for the website. Check your system's audio input/output settings.

---

## For Developers

This project serves as a reference for integrating Telnyx WebRTC into a Next.js application using React, Tailwind CSS, and ShadCN UI components.

### Prerequisites

*   Node.js (LTS version recommended)
*   npm or yarn
*   A Telnyx account with an active SIP Connection (configured for "Credentials" authentication).
*   A phone number associated with your Telnyx account to use as a Caller ID.

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

Execute the following command to start the Next.js development server:
```bash
npm run dev
```
The application will typically be available at `http://localhost:9002`.

### Configuration & Telnyx Integration

**1. Telnyx SIP Credentials:**
*   The application requires users to log in with their Telnyx SIP Connection username and password.
*   These credentials are submitted via a form on the `/login` page.
*   The `src/lib/actions.ts` server action handles the "login":
    *   It validates that a username and password are provided.
    *   It stores the provided SIP username and password in browser cookies (`telnyx_sip_username`, `telnyx_sip_password`). These cookies are **not httpOnly** as they need to be read by client-side JavaScript for the Telnyx SDK.
*   The `src/app/dashboard/page.tsx` component reads these cookies to initialize the `TelnyxRTC` client.

**2. Caller ID Number:**
*   The `CALLER_ID_NUMBER` used for outgoing calls is managed on the client-side within `src/app/dashboard/page.tsx`.
*   If no Caller ID is found in `localStorage` (under the key `telnyx_caller_id`), the user is prompted to enter and save it.
*   Once saved, the Caller ID is stored in `localStorage` for persistence across sessions on the same browser.
*   The Telnyx client will only attempt to connect if both SIP credentials (from cookies) and a Caller ID (from `localStorage` or user input) are available.

**3. Telnyx WebRTC SDK (`@telnyx/webrtc`):**
*   The SDK is initialized in `src/app/dashboard/page.tsx`.
*   Key event listeners are attached:
    *   `telnyx.ready`: Indicates successful connection to Telnyx.
    *   `telnyx.error`: Handles connection errors.
    *   `telnyx.socket.close`: Handles disconnections.
    *   `telnyx.notification`: Used to receive events like incoming calls (`callUpdate`) or media errors (`userMediaError`).
*   Call lifecycle (new call, answer, hangup, mute, hold) is managed using methods on the `TelnyxCall` object.
*   An `<audio id="remoteAudio" />` element in `src/app/dashboard/layout.tsx` is used to play the remote audio stream.

### Key Files & Structure

*   **`src/app/login/page.tsx`**: The login page UI.
*   **`src/components/auth/LoginForm.tsx`**: The actual login form component.
*   **`src/lib/actions.ts`**: Contains server actions for `login` and `logout`, including cookie management.
*   **`src/app/dashboard/page.tsx`**: The main dashboard page where all WebRTC logic resides. This includes Telnyx client initialization, call handling, and UI state management for calls.
*   **`src/app/dashboard/layout.tsx`**: Layout for the authenticated dashboard section, includes the remote audio element.
*   **`src/components/call/`**: Contains UI components related to calls (Dialpad, CallDisplay, CallControls, IncomingCallAlert).
*   **`src/components/history/CallHistory.tsx`**: Component to display call logs.
*   **`src/types/call.ts`**: TypeScript type definitions for call states and log entries.
*   **`src/hooks/use-toast.ts`**: Custom hook for displaying toast notifications.
*   **`package.json`**: Lists project dependencies, including `@telnyx/webrtc`.

### Important Security Note for Developers
Storing SIP credentials directly in client-readable cookies and relying on client-side `localStorage` for Caller ID is done here for simplicity in this demo application. **For production applications, this is NOT a recommended security practice.**

Consider the following for a production environment:
*   **Backend-for-Frontend (BFF)**: Implement a secure backend endpoint that authenticates your application's users.
*   **Token-Based Authentication for Telnyx**: Your BFF, after authenticating the user, should securely obtain a short-lived `login_token` from Telnyx (e.g., using Telnyx API keys server-side). This `login_token` is then passed to the frontend to initialize `TelnyxRTC`. This avoids exposing long-lived SIP passwords to the client.
*   **Secure Credential Storage**: Store primary user identifiers or session tokens in secure, `httpOnly` cookies.

### Further Development
*   Implement video calling features.
*   Add functionality to select audio input/output devices.
*   Integrate Telnyx Call Control features for more advanced call management.
*   Enhance error handling and connection recovery logic.
*   Implement a more robust backend authentication system.
