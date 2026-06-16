import mobileAds, {
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    AdEventType,
    RewardedAd,
    RewardedAdEventType,
    TestIds,
} from 'react-native-google-mobile-ads';

// Test IDs — replace with real IDs before production
export const AD_UNIT_IDS = {
    banner: TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
    rewarded: TestIds.REWARDED,
};

// Initialize AdMob
export const initializeAds = async () => {
    try {
        await mobileAds().initialize();
    } catch (e) {
        console.error('AdMob init error:', e);
    }
};

// Load and show interstitial ad
export const showInterstitialAd = (): Promise<void> => {
    return new Promise((resolve) => {
        try {
            const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
                requestNonPersonalizedAdsOnly: false,
            });

            interstitial.addAdEventListener(AdEventType.LOADED, () => {
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
