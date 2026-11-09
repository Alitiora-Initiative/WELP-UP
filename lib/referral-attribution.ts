const REFERRAL_STORAGE_KEY = 'welpup_referrer_key';
const BASE58_PUBLIC_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidReferralKey(value: string): boolean {
  return BASE58_PUBLIC_KEY.test(value);
}

export type ReferralState = { referrerKey: string | null; timestamp: number | null };

export function captureReferralFromUrl(url: URL, storage: Pick<Storage, 'getItem' | 'setItem'>): string | null {
  const candidate = url.searchParams.get('ref');
  if (candidate === null) return storage.getItem(REFERRAL_STORAGE_KEY);
  if (!isValidReferralKey(candidate)) return null;
  storage.setItem(REFERRAL_STORAGE_KEY, candidate);
  return candidate;
}

export function readReferral(storage: Pick<Storage, 'getItem'>): string | null {
  const candidate = storage.getItem(REFERRAL_STORAGE_KEY);
  return candidate !== null && isValidReferralKey(candidate) ? candidate : null;
}

export const getReferrerKey = (): string | null => {
  return safelyGetReferrer().referrerKey;
};

export const safelyGetReferrer = (): ReferralState => {
  if (typeof window === 'undefined') return { referrerKey: null, timestamp: null };
  try {
    const key = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    const rawTime = window.localStorage.getItem('welpup_referrer_time');
    const parsedTime = rawTime === null ? null : Number.parseInt(rawTime, 10);
    return {
      referrerKey: key !== null && isValidReferralKey(key) ? key : null,
      timestamp: parsedTime !== null && Number.isSafeInteger(parsedTime) && parsedTime >= 0 ? parsedTime : null,
    };
  } catch {
    return { referrerKey: null, timestamp: null };
  }
};

export const safelyCaptureReferrer = (queryString: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const candidate = new URLSearchParams(queryString).get('ref');
    if (candidate === null || !isValidReferralKey(candidate)) return;
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, candidate);
    window.localStorage.setItem('welpup_referrer_time', String(Date.now()));
  } catch {
    return;
  }
};

export const captureReferralUrl = (): void => {
  if (typeof window === 'undefined') return;
  safelyCaptureReferrer(window.location.search);
};

export function installReferralCapture(): () => void {
  const capture = () => {
    try {
      captureReferralUrl();
    } catch {
      return;
    }
  };
  capture();
  window.addEventListener('popstate', capture);
  return () => window.removeEventListener('popstate', capture);
}
