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

// ── Rewarded-ad single-flight guard ──────────────────────────────────────────
// Prevents multiple concurrent ad instances being created (e.g. from rapid taps).
// Any call to showRewardedAd() while a load/show is already in flight is a no-op.
let _isRewardedAdInFlight = false;

// Load and show rewarded ad.
// onLoadingChange?: called with true when load starts, false on every terminal path.
export const showRewardedAd = (
    onLoadingChange?: (isLoading: boolean) => void,
): Promise<boolean> => {
    // Single-flight guard: silently ignore if already in progress
    if (_isRewardedAdInFlight) return Promise.resolve(false);

    _isRewardedAdInFlight = true;
    onLoadingChange?.(true);

    return new Promise((resolve) => {
        let earnedReward = false;
        let settled = false;
        let unsubscribers: Array<() => void> = [];

        const cleanup = () => {
            unsubscribers.forEach((unsub) => {
                try { unsub(); } catch (_) {}
            });
            unsubscribers = [];
        };

        const finish = (result: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            _isRewardedAdInFlight = false;
            onLoadingChange?.(false);
            resolve(result);
        };

        try {
            const rewarded = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded, {
                requestNonPersonalizedAdsOnly: false,
            });

            unsubscribers.push(
                rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
                    try {
                        rewarded.show();
                    } catch (e) {
                        finish(false);
                    }
                })
            );

            unsubscribers.push(
                rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
                    // Record reward earned — wait for user to close ad before resolving caller
                    earnedReward = true;
                })
            );

            unsubscribers.push(
                rewarded.addAdEventListener(AdEventType.CLOSED, () => {
                    // Settle with reward result only after the native ad modal is dismissed
                    finish(earnedReward);
                })
            );

            unsubscribers.push(
                rewarded.addAdEventListener(AdEventType.ERROR, () => {
                    finish(false);
                })
            );

            rewarded.load();
        } catch (e) {
            finish(false);
        }
    });
};

export { BannerAd, BannerAdSize };
