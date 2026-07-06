// Lightweight singleton so the frontend can poll the supervisor crawl's login-wait status.
// Mirrors the pattern of marketingAgent.state / geminiAgent.state for UI consistency.
//
// Human-in-the-loop login: when the agent hits a login / CAPTCHA / "are you a robot?" wall,
// it flips to waiting_for_login and BLOCKS until the user explicitly clicks "I've logged in"
// in our web app (which sets userConfirmedLogin=true). The auto-heuristic is only a hint —
// the human is the source of truth, so CAPTCHAs and 2FA work.

export type SupervisorStatus = 'idle' | 'crawling' | 'waiting_for_login' | 'complete' | 'error';

export interface SupervisorState {
  status: SupervisorStatus;
  message: string;
  targetUrl: string | null;
  loginRequired: boolean;
  needsAttention: boolean;       // true while the user must act (drives the pulsing UI box)
  userConfirmedLogin: boolean;   // set true when the user clicks "I've logged in — continue"
  autoDetectedLogin: boolean;    // the heuristic's opinion (shown as a hint, not the trigger)
}

class SupervisorStateStore {
  private _state: SupervisorState = {
    status: 'idle',
    message: 'Supervisor is idle.',
    targetUrl: null,
    loginRequired: false,
    needsAttention: false,
    userConfirmedLogin: false,
    autoDetectedLogin: false,
  };

  get state(): SupervisorState {
    return { ...this._state };
  }

  set(partial: Partial<SupervisorState>) {
    this._state = { ...this._state, ...partial };
    console.log(`[Supervisor] ${this._state.status}: ${this._state.message}`);
  }

  // Called by the /supervisor/confirm-login endpoint when the user clicks the button.
  confirmLogin() {
    this._state = { ...this._state, userConfirmedLogin: true, needsAttention: false };
    console.log('[Supervisor] ✅ User confirmed login — resuming crawl.');
  }

  reset() {
    this.set({
      status: 'idle',
      message: 'Supervisor is idle.',
      targetUrl: null,
      loginRequired: false,
      needsAttention: false,
      userConfirmedLogin: false,
      autoDetectedLogin: false,
    });
  }
}

export const supervisorState = new SupervisorStateStore();
