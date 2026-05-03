const WALLET_BIND_RETURN_KEY = "wallet-bind-return-until";
const WALLET_BIND_RETURN_TTL_MS = 2 * 60 * 1000;

const canUseLocalStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const markWalletBindReturn = () => {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(WALLET_BIND_RETURN_KEY, String(Date.now() + WALLET_BIND_RETURN_TTL_MS));
  }
};

export const clearWalletBindReturn = () => {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(WALLET_BIND_RETURN_KEY);
  }
};

