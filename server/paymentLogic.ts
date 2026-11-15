/** Pure Razorpay helpers (no SDK import) — unit-tested in tests/settings.test.ts. */
export const modeOf = (keyId: string): 'live' | 'test' => (keyId.startsWith('rzp_live_') ? 'live' : 'test');
export const KEY_ID_RE = /^rzp_(live|test)_[A-Za-z0-9]{8,32}$/;
