export const WALLET_BIND_INTENT_KEY = "pending-wallet-bind-intent";

const WALLET_BIND_INTENT_TTL_MS = 10 * 60 * 1000;

export type WalletBindIntent = {
  createdAt: number;
  studentId?: string;
  walletAddress?: string;
  challengeToken?: string;
  signature?: string;
};

const canUseLocalStorage = () => typeof window !== "undefined" && !!window.localStorage;

const isFresh = (createdAt: number) => Date.now() - createdAt <= WALLET_BIND_INTENT_TTL_MS;

export const getWalletBindIntent = (): WalletBindIntent | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(WALLET_BIND_INTENT_KEY);
  if (!rawValue) {
    return null;
  }

  const numericCreatedAt = Number(rawValue);
  if (Number.isFinite(numericCreatedAt)) {
    if (!isFresh(numericCreatedAt)) {
      clearWalletBindIntent();
      return null;
    }

    return { createdAt: numericCreatedAt };
  }

  try {
    const parsed = JSON.parse(rawValue) as WalletBindIntent;
    if (!Number.isFinite(parsed.createdAt) || !isFresh(parsed.createdAt)) {
      clearWalletBindIntent();
      return null;
    }

    return parsed;
  } catch {
    clearWalletBindIntent();
    return null;
  }
};

export const setWalletBindIntent = (updates: Partial<Omit<WalletBindIntent, "createdAt">> = {}) => {
  if (canUseLocalStorage()) {
    const current = getWalletBindIntent();
    const next: WalletBindIntent = {
      createdAt: current?.createdAt ?? Date.now(),
      ...current,
      ...updates,
    };
    window.localStorage.setItem(WALLET_BIND_INTENT_KEY, JSON.stringify(next));
  }
};

export const clearWalletBindIntent = () => {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(WALLET_BIND_INTENT_KEY);
  }
};

export const hasWalletBindIntent = () => !!getWalletBindIntent();
