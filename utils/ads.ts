import { AppState } from 'react-native';
import mobileAds, {
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    AdEventType,
    RewardedAd,
    RewardedAdEventType,
    TestIds,
} from 'react-native-google-mobile-ads';

export const AD_UNIT_IDS = {
    banner: __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-7658674851177824/9719730461',
    interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-7658674851177824/3997801355',
    rewarded: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7658674851177824/4491454519',
};

// Singleton initialization state
let _initPromise: Promise<void> | null = null;
let _isAdsInitialized = false;

// Initialize AdMob
export const initializeAds = (): Promise<void> => {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
        try {
            await mobileAds().initialize();
            _isAdsInitialized = true;
        } catch (e: any) {
            const errorMessage = e?.message || (typeof e === 'string' ? e : 'Unknown error');
            console.error(`[AdMob] Initialization failed: ${errorMessage}`);
            _isAdsInitialized = true;
        }
    })();
    return _initPromise;
};

export const isAdsInitialized = (): boolean => _isAdsInitialized;

// ── Modal-open guard ─────────────────────────────────────────────────────
// Screens call setInterstitialBlocked(true) when a form/modal is open so
// a delayed interstitial (e.g. home-screen 120 s timer or habit-completion
// counter) cannot interrupt the user mid-flow. Call with false on close.
let _interstitialBlocked = false;
let _pendingInterstitialShow: (() => void) | null = null;

export function setInterstitialBlocked(blocked: boolean): void {
    _interstitialBlocked = blocked;
    if (!blocked && _pendingInterstitialShow) {
        const show = _pendingInterstitialShow;
        _pendingInterstitialShow = null;
        show();
    }
}

// ── Interstitial-ad single-flight guard ──────────────────────────────────
let _isInterstitialInFlight = false;

// Load and show interstitial ad
export const showInterstitialAd = async (): Promise<boolean> => {
    if (_isInterstitialInFlight) {
        console.warn('[AdMob] Interstitial ad request ignored: an ad is already in flight.');
        return false;
    }

    // Ensure SDK is initialized before requesting an interstitial
    await initializeAds();

    _isInterstitialInFlight = true;

    return new Promise((resolve) => {
        let settled = false;
        let unsubscribers: Array<() => void> = [];

        const cleanup = () => {
            unsubscribers.forEach((unsub) => {
                try { unsub(); } catch (_) {}
            });
            unsubscribers = [];
            _pendingInterstitialShow = null;
        };

        const finish = (result: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            _isInterstitialInFlight = false;
            resolve(result);
        };

        try {
            const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
                requestNonPersonalizedAdsOnly: false,
            });

            const tryShow = () => {
                try {
                    interstitial.show();
                } catch (e: any) {
                    const errorCode = e?.code || 'UNKNOWN';
                    const errorMessage = e?.message || (typeof e === 'string' ? e : 'Unknown error');
                    console.error(`[AdMob] Interstitial show failed | Error code: ${errorCode} | Error message: ${errorMessage}`);
                    finish(false);
                }
            };

            unsubscribers.push(
                interstitial.addAdEventListener(AdEventType.LOADED, () => {
                    if (_interstitialBlocked) {
                        console.warn('[AdMob] Interstitial loaded while UI is blocked. Retaining ad until UI is unblocked.');
                        _pendingInterstitialShow = tryShow;
                        return;
                    }
                    tryShow();
                })
            );

            unsubscribers.push(
                interstitial.addAdEventListener(AdEventType.CLOSED, () => {
                    finish(true);
                })
            );

            unsubscribers.push(
                interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
                    const errorCode = error?.code || 'UNKNOWN';
                    const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
                    console.error(`[AdMob] Interstitial load failed | Error code: ${errorCode} | Error message: ${errorMessage}`);
                    finish(false);
                })
            );

            interstitial.load();
        } catch (e: any) {
            const errorCode = e?.code || 'UNKNOWN';
            const errorMessage = e?.message || (typeof e === 'string' ? e : 'Unknown error');
            console.error(`[AdMob] Interstitial initialization/load failed | Error code: ${errorCode} | Error message: ${errorMessage}`);
            finish(false);
        }
    });
};

export interface ShowRewardedAdOptions {
    onLoadingChange?: (isLoading: boolean) => void;
    isCancelled?: () => boolean;
    timeoutMs?: number;
}

// ── Rewarded-ad single-flight guard & request tracker ─────────────────────────
// Prevents multiple concurrent ad instances being created (e.g. from rapid taps).
// Any call to showRewardedAd() while a load/show is already in flight is a no-op.
let _isRewardedAdInFlight = false;
let _rewardedRequestSeq = 0;
let _activeRewardedRequestId = 0;

// Load and show rewarded ad.
// optionsOrLoadingChange?: called with true when load starts, false on every terminal path,
// or an options object with onLoadingChange, isCancelled check, and timeoutMs.
export const showRewardedAd = async (
    optionsOrLoadingChange?: ((isLoading: boolean) => void) | ShowRewardedAdOptions,
): Promise<boolean> => {
    // Single-flight guard: safely ignore if already in progress
    if (_isRewardedAdInFlight) {
        console.warn('[AdMob] Rewarded ad request ignored: an ad is already in flight.');
        return false;
    }

    // Ensure SDK initialization has completed before requesting
    await initializeAds();

    _isRewardedAdInFlight = true;

    const onLoadingChange =
        typeof optionsOrLoadingChange === 'function'
            ? optionsOrLoadingChange
            : optionsOrLoadingChange?.onLoadingChange;
    const isCancelled =
        typeof optionsOrLoadingChange === 'object'
            ? optionsOrLoadingChange?.isCancelled
            : undefined;
    const timeoutMs =
        typeof optionsOrLoadingChange === 'object' && optionsOrLoadingChange?.timeoutMs
            ? optionsOrLoadingChange.timeoutMs
            : 15000;

    onLoadingChange?.(true);

    const requestId = ++_rewardedRequestSeq;
    _activeRewardedRequestId = requestId;

    return new Promise((resolve) => {
        let earnedReward = false;
        let settled = false;
        let adLoaded = false;
        let unsubscribers: Array<() => void> = [];

        const cleanup = () => {
            clearTimeout(timeoutTimer);
            unsubscribers.forEach((unsub) => {
                try { unsub(); } catch (_) {}
            });
            unsubscribers = [];
            if (_activeRewardedRequestId === requestId) {
                _activeRewardedRequestId = 0;
            }
        };

        const finish = (result: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            _isRewardedAdInFlight = false;
            onLoadingChange?.(false);
            resolve(result);
        };

        // Safety load timeout: if network stalls, do not let ad popup unexpectedly later
        const timeoutTimer = setTimeout(() => {
            if (!adLoaded && !settled) {
                console.warn(`[AdMob] Rewarded ad load timed out after ${timeoutMs}ms.`);
                finish(false);
            }
        }, timeoutMs);

        try {
            const rewarded = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded, {
                requestNonPersonalizedAdsOnly: false,
            });

            unsubscribers.push(
                rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
                    adLoaded = true;

                    // Stale / Cancelled request check
                    if (_activeRewardedRequestId !== requestId) {
                        console.warn('[AdMob] Rewarded ad loaded but request is no longer active (stale/cancelled).');
                        finish(false);
                        return;
                    }

                    // Caller context check
                    if (isCancelled && isCancelled()) {
                        console.warn('[AdMob] Rewarded ad loaded but caller context was cancelled/unmounted.');
                        finish(false);
                        return;
                    }

                    // Foreground active app state check
                    if (AppState.currentState !== 'active') {
                        console.warn('[AdMob] Rewarded ad loaded but app is not in foreground active state.');
                        finish(false);
                        return;
                    }

                    try {
                        rewarded.show();
                    } catch (e: any) {
                        const errorCode = e?.code || 'UNKNOWN';
                        const errorMessage = e?.message || (typeof e === 'string' ? e : 'Unknown error');
                        console.error(`[AdMob] Rewarded show failed | Error code: ${errorCode} | Error message: ${errorMessage}`);
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
                rewarded.addAdEventListener(AdEventType.ERROR, (error: any) => {
                    const errorCode = error?.code || 'UNKNOWN';
                    const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
                    console.error(`[AdMob] Rewarded load/display failed | Error code: ${errorCode} | Error message: ${errorMessage}`);
                    finish(false);
                })
            );

            rewarded.load();
        } catch (e: any) {
            const errorCode = e?.code || 'UNKNOWN';
            const errorMessage = e?.message || (typeof e === 'string' ? e : 'Unknown error');
            console.error(`[AdMob] Rewarded initialization/load failed | Error code: ${errorCode} | Error message: ${errorMessage}`);
            finish(false);
        }
    });
};

export { BannerAd, BannerAdSize };
