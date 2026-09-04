import { useEffect, useState } from "react";

type Listener = (loaded: boolean) => void;
const listeners = new Set<Listener>();
let _isBannerLoaded = false;

export function setGlobalBannerLoaded(loaded: boolean): void {
  if (_isBannerLoaded === loaded) return;
  _isBannerLoaded = loaded;
  listeners.forEach((fn) => {
    try {
      fn(loaded);
    } catch (_) {}
  });
}

export function isGlobalBannerLoaded(): boolean {
  return _isBannerLoaded;
}

export function useBannerLoaded(): boolean {
  const [loaded, setLoaded] = useState(_isBannerLoaded);

  useEffect(() => {
    // Sync in case state changed before mount
    setLoaded(_isBannerLoaded);
    listeners.add(setLoaded);
    return () => {
      listeners.delete(setLoaded);
    };
  }, []);

  return loaded;
}
