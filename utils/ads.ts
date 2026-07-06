import mobileAds, {
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    AdEventType,
    RewardedAd,
    RewardedAdEventType,
} from 'react-native-google-mobile-ads';

export const AD_UNIT_IDS = {
    banner: 'ca-app-pub-7658674851177824/9719730461',
    interstitial: 'ca-app-pub-7658674851177824/3997801355',
    rewarded: 'ca-app-pub-7658674851177824/4491454519',
};

// Initialize AdMob
export const initializeAds = async () => {
    try {
        await mobileAds().initialize();
    } catch (e) {
        console.error('AdMob init error:', e);
    }
};

// ── Modal-open guard ─────────────────────────────────────────────────────
// Screens call setInterstitialBlocked(true) when a form/modal is open so
// a delayed interstitial (e.g. home-screen 120 s timer or habit-completion
// counter) cannot interrupt the user mid-flow. Call with false on close.
let _interstitialBlocked = false;
export function setInterstitialBlocked(blocked: boolean): void {
    _interstitialBlocked = blocked;
}

// Load and show interstitial ad
export const showInterstitialAd = (): Promise<void> => {
    return new Promise((resolve) => {
        try {
            const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
                requestNonPersonalizedAdsOnly: false,
            });

            interstitial.addAdEventListener(AdEventType.LOADED, () => {
                // Do not show if a modal/form is currently open
                if (_interstitialBlocked) { resolve(); return; }
                try {
                    interstitial.show();
                } catch (e) {
                    resolve();
                }
            });

            interstitial.addAdEventListener(AdEventType.CLOSED, () => {
                resolve();
            });

            interstitial.addAdEventListener(AdEventType.ERROR, () => {
                resolve(); // resolve anyway so app doesn't block
            });

            interstitial.load();
        } catch (e) {
            resolve();
        }
    });
};

// Load and show rewarded ad
export const showRewardedAd = (): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const rewarded = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded, {
                requestNonPersonalizedAdsOnly: false,
            });

            rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
                try {
                    rewarded.show();
                } catch (e) {
                    resolve(false);
                }
            });

            rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
                resolve(true);
            });

            rewarded.addAdEventListener(AdEventType.CLOSED, () => {
                resolve(false);
            });

            rewarded.addAdEventListener(AdEventType.ERROR, () => {
                resolve(false);
            });

            rewarded.load();
        } catch (e) {
            resolve(false);
        }
    });
};

export { BannerAd, BannerAdSize };
