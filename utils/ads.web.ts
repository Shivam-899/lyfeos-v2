import React from "react";

export const AD_UNIT_IDS = {
  banner: "ca-app-pub-7658674851177824/9719730461",
  interstitial: "ca-app-pub-7658674851177824/3997801355",
  rewarded: "ca-app-pub-7658674851177824/4491454519",
};

export const initializeAds = async (): Promise<void> => { };

export function setInterstitialBlocked(blocked: boolean): void { }

export const showInterstitialAd = (): Promise<void> => Promise.resolve();

export const showRewardedAd = (
  onLoadingChange?: (isLoading: boolean) => void,
): Promise<boolean> => Promise.resolve(false);

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
