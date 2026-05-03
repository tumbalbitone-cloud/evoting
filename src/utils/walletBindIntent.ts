export const WALLET_BIND_INTENT_KEY = "pending-wallet-bind-intent";

const WALLET_BIND_INTENT_TTL_MS = 10 * 60 * 1000;

const canUseLocalStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const setWalletBindIntent = () => {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(WALLET_BIND_INTENT_KEY, String(Date.now()));
  }
};

export const clearWalletBindIntent = () => {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(WALLET_BIND_INTENT_KEY);
  }
};

export const hasWalletBindIntent = () => {
  if (!canUseLocalStorage()) {
    return false;
  }

  const rawValue = window.localStorage.getItem(WALLET_BIND_INTENT_KEY);
  const createdAt = Number(rawValue);
  if (!rawValue || !Number.isFinite(createdAt)) {
    clearWalletBindIntent();
    return false;
  }

  if (Date.now() - createdAt > WALLET_BIND_INTENT_TTL_MS) {
    clearWalletBindIntent();
    return false;
  }

  return true;
};
