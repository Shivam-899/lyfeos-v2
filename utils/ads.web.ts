import React from "react";

export const TestIds = {
  BANNER: "ca-app-pub-3940256099942544/6300978111",
  ADAPTIVE_BANNER: "ca-app-pub-3940256099942544/9214589741",
  INTERSTITIAL: "ca-app-pub-3940256099942544/1033173712",
  REWARDED: "ca-app-pub-3940256099942544/5224354917",
};

export const AD_UNIT_IDS = {
  banner: typeof __DEV__ !== "undefined" && __DEV__ ? TestIds.ADAPTIVE_BANNER : "ca-app-pub-7658674851177824/9719730461",
  interstitial: typeof __DEV__ !== "undefined" && __DEV__ ? TestIds.INTERSTITIAL : "ca-app-pub-7658674851177824/3997801355",
  rewarded: typeof __DEV__ !== "undefined" && __DEV__ ? TestIds.REWARDED : "ca-app-pub-7658674851177824/4491454519",
};

export const initializeAds = async (): Promise<void> => { };
export const isAdsInitialized = (): boolean => true;

export function setInterstitialBlocked(blocked: boolean): void { }

export const showInterstitialAd = (): Promise<boolean> => Promise.resolve(false);

export interface ShowRewardedAdOptions {
  onLoadingChange?: (isLoading: boolean) => void;
  isCancelled?: () => boolean;
  timeoutMs?: number;
}

export const showRewardedAd = (
  optionsOrLoadingChange?: ((isLoading: boolean) => void) | ShowRewardedAdOptions,
): Promise<boolean> => {
  if (typeof optionsOrLoadingChange === 'function') {
    optionsOrLoadingChange(false);
  } else if (optionsOrLoadingChange?.onLoadingChange) {
    optionsOrLoadingChange.onLoadingChange(false);
  }
  return Promise.resolve(false);
};

export const BannerAdSize = {
  BANNER: "BANNER",
  FULL_BANNER: "FULL_BANNER",
  LARGE_BANNER: "LARGE_BANNER",
  LEADERBOARD: "LEADERBOARD",
  MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
  ADAPTIVE_BANNER: "ADAPTIVE_BANNER",
  ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER",
};

export const BannerAd = () => null;
