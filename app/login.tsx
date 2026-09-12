import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import { statusCodes } from "@react-native-google-signin/google-signin";

const THEME = {
  BG: "#0F0F0F",
  CARD: "#1A1A1A",
  CARD_BORDER: "#333333",
  TEXT: "#FFFFFF",
  MUTED: "#A1A1AA",
  ACCENT: "#FF6B35",
  ERROR: "#EF4444",
};

export default function LoginScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsGuest,
    isPendingMigrationResolution,
    mergeGuestDataAndProceed,
    discardGuestDataAndProceed,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | "guest" | null>(null);
  const [error, setError] = useState("");

  // ── Forgot Password state ─────────────────────────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  // ── Guest Migration Resolution state (Phase 2B-3) ─────────────────────────
  const [resolutionView, setResolutionView] = useState<"decision" | "confirm_discard">("decision");
  const [resolutionLoading, setResolutionLoading] = useState<"merge" | "discard" | null>(null);
  const [resolutionError, setResolutionError] = useState<{
    title: string;
    message: string;
    action: "merge" | "discard";
  } | null>(null);

  // Reset resolution modal internal state whenever pending migration flag changes
  useEffect(() => {
    if (isPendingMigrationResolution) {
      setResolutionView("decision");
      setResolutionLoading(null);
      setResolutionError(null);
    }
  }, [isPendingMigrationResolution]);

  const handleMerge = async () => {
    if (resolutionLoading !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResolutionLoading("merge");
    setResolutionError(null);
    try {
      await mergeGuestDataAndProceed();
    } catch (err: any) {
      if (__DEV__) console.warn("[GuestResolution] Merge failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResolutionError({
        title: "Unable to Merge Data",
        message: "We encountered an issue while merging your guest data. Please check your connection and try again.",
        action: "merge",
      });
    } finally {
      setResolutionLoading(null);
    }
  };

  const handleStartDiscard = () => {
    if (resolutionLoading !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResolutionError(null);
    setResolutionView("confirm_discard");
  };

  const handleCancelDiscard = () => {
    if (resolutionLoading !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResolutionError(null);
    setResolutionView("decision");
  };

  const handleConfirmDiscard = async () => {
    if (resolutionLoading !== null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setResolutionLoading("discard");
    setResolutionError(null);
    try {
      await discardGuestDataAndProceed();
    } catch (err: any) {
      if (__DEV__) console.warn("[GuestResolution] Discard failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResolutionError({
        title: "Unable to Discard Data",
        message: "We encountered an issue while discarding your guest data. Please try again.",
        action: "discard",
      });
    } finally {
      setResolutionLoading(null);
    }
  };

  const handleModalRequestClose = () => {
    // Prevent dismissal while processing
    if (resolutionLoading !== null) return;

    // Android back on Discard Confirmation returns to Decision view
    if (resolutionView === "confirm_discard") {
      Haptics.selectionAsync();
      setResolutionError(null);
      setResolutionView("decision");
      return;
    }

    // Modal is strictly non-dismissible while pending resolution on Decision view
  };

  const fadeAnim = useState(new Animated.Value(1))[0];
  const formHeight = useState(new Animated.Value(isSignUp ? 380 : 330))[0];

  const handleToggleMode = () => {
    Haptics.selectionAsync();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(formHeight, {
        toValue: isSignUp ? 330 : 380,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSignUp(!isSignUp);
      setError("");
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleGoogleAuth = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading("google");
    setError("");
    try {
      await signInWithGoogle();
      setLoading(null);
      // Router handles redirection in _layout.tsx based on Auth state
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        setLoading(null);
        return;
      }
      
      if (__DEV__) console.warn("[GoogleSignIn] Error:", err);

      if (err.code === statusCodes.IN_PROGRESS) {
        setError("Sign-in already in progress. Please wait.");
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Google Play Services isn't available on this device.");
      } else if (err.code === "auth/credential-already-in-use" || err.code === "auth/email-already-in-use") {
        setError("This Google account is already registered. Please sign in with email instead.");
      } else {
        setError("We're having trouble connecting to Google right now. Please try again, or sign in with email instead.");
      }
      
      setLoading(null);
    }
  };

  const handleEmailAuth = async () => {
    if (loading) return;
    if (!email || !password || (isSignUp && !name)) {
      setError("Please fill in all fields.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading("email");
    setError("");

    try {
      if (isSignUp) {
        await signUpWithEmail(name, email, password);
      } else {
        await signInWithEmail(email, password);
      }
      setLoading(null);
    } catch (err: any) {
      let msg = "Authentication failed.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") msg = "Incorrect email or password.";
      if (err.code === "auth/email-already-in-use" || err.code === "auth/credential-already-in-use") msg = "Email is already in use.";
      if (err.code === "auth/weak-password") msg = "Password is too weak.";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(null);
    }
  };

  const handleGuestAuth = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading("guest");
    setError("");
    try {
      await signInAsGuest();
    } catch (err: any) {
      setError("Failed to continue as guest.");
      setLoading(null);
    }
  };

  // ── Forgot Password handler ───────────────────────────────────────────────
  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      setResetError("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      await auth().sendPasswordResetEmail(resetEmail.trim());
      setResetSent(true);
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        setResetError("No account found with this email.");
      } else if (e.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else {
        setResetError("Failed to send reset link. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const openResetModal = () => {
    setResetEmail(email); // pre-fill with whatever the user already typed
    setResetSent(false);
    setResetError("");
    setShowResetModal(true);
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>LyfeOS</Text>
            <Text style={styles.tagline}>Your Life Operating System</Text>
          </View>

          <View style={styles.authContainer}>
            {/* Google Button */}
            <TouchableOpacity 
              style={styles.googleBtn} 
              onPress={handleGoogleAuth}
              activeOpacity={0.8}
              disabled={loading !== null}
            >
              {loading === "google" ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#000" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Form */}
            <Animated.View style={[styles.formCard, { height: formHeight }]}>
              <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: "space-between" }}>
                <View>
                  <View style={styles.inputs}>
                    {isSignUp && (
                      <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor={THEME.MUTED}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    )}
                    <TextInput
                      style={styles.input}
                      placeholder="Email address"
                      placeholderTextColor={THEME.MUTED}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor={THEME.MUTED}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity 
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        <Ionicons 
                          name={showPassword ? "eye-off" : "eye"} 
                          size={20} 
                          color={THEME.MUTED} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Stable Error Container */}
                  <View style={styles.errorContainer}>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  </View>
                </View>

                <View style={styles.actionsContainer}>
                  <TouchableOpacity 
                    style={styles.primaryBtn} 
                    onPress={handleEmailAuth}
                    activeOpacity={0.8}
                    disabled={loading !== null}
                  >
                    {loading === "email" ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {isSignUp ? "Create Account" : "Sign In"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Forgot Password — only visible in Sign In mode */}
                  {!isSignUp && (
                    <TouchableOpacity style={styles.forgotBtn} onPress={openResetModal}>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={handleToggleMode} style={styles.toggleBtn}>
                    <Text style={styles.toggleText}>
                      {isSignUp 
                        ? "Already have an account? Sign In" 
                        : "Don't have an account? Sign Up"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Animated.View>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
            </View>

            {/* Guest Button */}
            <TouchableOpacity 
              style={styles.guestBtn} 
              onPress={handleGuestAuth}
              disabled={loading !== null}
            >
              {loading === "guest" ? (
                <ActivityIndicator color={THEME.MUTED} />
              ) : (
                <Text style={styles.guestText}>Continue as Guest</Text>
              )}
            </TouchableOpacity>

          </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

    {/* ── Forgot Password Modal ─────────────────────────────────────────────── */}
    <Modal
      visible={showResetModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowResetModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowResetModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalCard}>
              {resetSent ? (
                // ── Success state ────────────────────────────────────────
                <>
                  <View style={styles.modalSuccessIcon}>
                    <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                  </View>
                  <Text style={styles.modalTitle}>Check Your Email</Text>
                  <Text style={styles.modalSubtitle}>
                    We sent you a password reset link. If you don't see it, check your Spam or Junk folder.
                  </Text>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={() => setShowResetModal(false)}
                  >
                    <Text style={styles.modalPrimaryBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // ── Input state ──────────────────────────────────────────
                <>
                  <Text style={styles.modalTitle}>Forgot Password?</Text>
                  <Text style={styles.modalSubtitle}>
                    Enter your email and we'll send you a reset link.
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Email address"
                    placeholderTextColor={THEME.MUTED}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                  {resetError ? (
                    <Text style={styles.resetErrorText}>{resetError}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={handlePasswordReset}
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalPrimaryBtnText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowResetModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

      {/* ── Guest Data Resolution Modal (Phase 2B-3) ────────────────────────── */}
      <Modal
        visible={isPendingMigrationResolution}
        transparent
        animationType="fade"
        onRequestClose={handleModalRequestClose}
        statusBarTranslucent
      >
        <View style={styles.resolutionOverlay}>
          <View style={styles.resolutionCard}>
            {resolutionLoading !== null ? (
              // ── Loading state ──
              <View style={styles.resolutionLoadingContainer}>
                <ActivityIndicator size="large" color={THEME.ACCENT} />
                <Text style={styles.resolutionLoadingText}>
                  {resolutionLoading === "merge"
                    ? "Merging your guest data..."
                    : "Discarding guest data..."}
                </Text>
              </View>
            ) : resolutionView === "decision" ? (
              // ── View A: Decision View ──
              <>
                <View style={styles.resolutionIconBadge}>
                  <Ionicons name="cloud-download-outline" size={32} color={THEME.ACCENT} />
                </View>

                <Text style={styles.resolutionTitle}>Guest Data Found</Text>

                <Text style={styles.resolutionSubtitle}>
                  We found data you created on this device while using LyfeOS as a guest. You can add it to your account or discard it.
                </Text>

                {/* Reassurance box */}
                <View style={styles.reassuranceBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#22C55E" style={styles.reassuranceIcon} />
                  <Text style={styles.reassuranceText}>
                    Your existing account data is safe and won't be overwritten.
                  </Text>
                </View>

                {/* Error & Retry Banner */}
                {resolutionError && (
                  <View style={styles.resolutionErrorBanner}>
                    <Ionicons name="alert-circle-outline" size={20} color={THEME.ERROR} />
                    <View style={styles.resolutionErrorContent}>
                      <Text style={styles.resolutionErrorTitle}>{resolutionError.title}</Text>
                      <Text style={styles.resolutionErrorMessage}>{resolutionError.message}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={resolutionError.action === "merge" ? handleMerge : handleConfirmDiscard}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Try Again"
                    >
                      <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.resolutionActions}>
                  {/* Primary CTA: Keep & Merge */}
                  <TouchableOpacity
                    style={styles.resolutionPrimaryBtn}
                    onPress={handleMerge}
                    activeOpacity={0.8}
                    disabled={resolutionLoading !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Keep & Merge Data: Adds your guest data to this account"
                  >
                    <Text style={styles.resolutionPrimaryBtnText}>Keep & Merge Data</Text>
                    <Text style={styles.resolutionPrimaryBtnHelper}>
                      Adds your guest data to this account
                    </Text>
                  </TouchableOpacity>

                  {/* Secondary CTA: Discard */}
                  <TouchableOpacity
                    style={styles.resolutionSecondaryBtn}
                    onPress={handleStartDiscard}
                    activeOpacity={0.7}
                    disabled={resolutionLoading !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Discard Guest Data: Permanently removes data from your guest session"
                  >
                    <Text style={styles.resolutionSecondaryBtnText}>Discard Guest Data</Text>
                    <Text style={styles.resolutionSecondaryBtnHelper}>
                      Permanently removes data from your guest session
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // ── View B: Discard Confirmation View ──
              <>
                <View style={styles.resolutionDangerBadge}>
                  <Ionicons name="trash-outline" size={32} color={THEME.ERROR} />
                </View>

                <Text style={styles.resolutionTitle}>Permanently Discard Guest Data?</Text>

                <Text style={styles.resolutionSubtitle}>
                  This will permanently remove the data created during your guest session. This action cannot be undone.{"\n\n"}Your existing account data will remain completely untouched.
                </Text>

                {/* Error & Retry Banner */}
                {resolutionError && (
                  <View style={styles.resolutionErrorBanner}>
                    <Ionicons name="alert-circle-outline" size={20} color={THEME.ERROR} />
                    <View style={styles.resolutionErrorContent}>
                      <Text style={styles.resolutionErrorTitle}>{resolutionError.title}</Text>
                      <Text style={styles.resolutionErrorMessage}>{resolutionError.message}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={handleConfirmDiscard}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Try Again"
                    >
                      <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Confirmation Actions */}
                <View style={styles.resolutionActions}>
                  {/* Destructive CTA */}
                  <TouchableOpacity
                    style={styles.resolutionDestructiveBtn}
                    onPress={handleConfirmDiscard}
                    activeOpacity={0.8}
                    disabled={resolutionLoading !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Yes, Permanently Discard"
                  >
                    <Text style={styles.resolutionDestructiveBtnText}>Yes, Permanently Discard</Text>
                  </TouchableOpacity>

                  {/* Cancel / Keep Data CTA */}
                  <TouchableOpacity
                    style={styles.resolutionCancelBtn}
                    onPress={handleCancelDiscard}
                    activeOpacity={0.7}
                    disabled={resolutionLoading !== null}
                    accessibilityRole="button"
                    accessibilityLabel="No, Keep Data"
                  >
                    <Text style={styles.resolutionCancelBtnText}>No, Keep Data</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.BG,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: "900",
    color: THEME.ACCENT,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: THEME.MUTED,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
  },
  authContainer: {
    width: "100%",
  },
  googleBtn: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  googleBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.CARD_BORDER,
  },
  dividerText: {
    color: THEME.MUTED,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  formCard: {
    backgroundColor: THEME.CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
  },
  inputs: {
    gap: 12,
  },
  input: {
    backgroundColor: THEME.BG,
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.TEXT,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passwordContainer: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    backgroundColor: THEME.BG,
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.TEXT,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  errorContainer: {
    minHeight: 22,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  errorText: {
    color: THEME.ERROR,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  actionsContainer: {
    width: "100%",
  },
  primaryBtn: {
    backgroundColor: THEME.ACCENT,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  forgotBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 6,
  },
  forgotText: {
    color: THEME.ACCENT,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  toggleBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleText: {
    color: THEME.MUTED,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  guestBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  guestText: {
    color: THEME.MUTED,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  // ── Forgot Password Modal styles ───────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: THEME.CARD,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  modalSuccessIcon: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.TEXT,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 15,
    color: THEME.MUTED,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: THEME.BG,
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.TEXT,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  resetErrorText: {
    color: THEME.ERROR,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 12,
  },
  modalPrimaryBtn: {
    backgroundColor: THEME.ACCENT,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  modalPrimaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  modalCancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  modalCancelText: {
    color: THEME.MUTED,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  // ── Guest Migration Resolution Modal styles (Phase 2B-3) ───────────────────
  resolutionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  resolutionCard: {
    backgroundColor: THEME.CARD,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  resolutionLoadingContainer: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 16,
  },
  resolutionLoadingText: {
    color: THEME.TEXT,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  resolutionIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 107, 53, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  resolutionDangerBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  resolutionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.TEXT,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  resolutionSubtitle: {
    fontSize: 15,
    color: THEME.MUTED,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  reassuranceBox: {
    flexDirection: "row",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 20,
  },
  reassuranceIcon: {
    marginTop: 2,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 13,
    color: "#E4E4E7",
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  resolutionErrorBanner: {
    flexDirection: "row",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  resolutionErrorContent: {
    flex: 1,
  },
  resolutionErrorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.ERROR,
    fontFamily: "Inter_600SemiBold",
  },
  resolutionErrorMessage: {
    fontSize: 12,
    color: "#D4D4D8",
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  retryBtn: {
    backgroundColor: THEME.ERROR,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  resolutionActions: {
    gap: 12,
    width: "100%",
  },
  resolutionPrimaryBtn: {
    backgroundColor: THEME.ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  resolutionPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  resolutionPrimaryBtnHelper: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  resolutionSecondaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  resolutionSecondaryBtnText: {
    color: THEME.TEXT,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  resolutionSecondaryBtnHelper: {
    color: THEME.MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  resolutionDestructiveBtn: {
    backgroundColor: THEME.ERROR,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  resolutionDestructiveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  resolutionCancelBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: THEME.CARD_BORDER,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  resolutionCancelBtnText: {
    color: THEME.TEXT,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
