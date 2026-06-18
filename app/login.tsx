import React, { useState } from "react";
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
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInAsGuest } = useAuth();
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

  const fadeAnim = useState(new Animated.Value(1))[0];
  const formHeight = useState(new Animated.Value(isSignUp ? 320 : 260))[0];

  const handleToggleMode = () => {
    Haptics.selectionAsync();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(formHeight, {
        toValue: isSignUp ? 260 : 320,
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
      // Router handles redirection in _layout.tsx based on Auth state
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.");
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
    } catch (err: any) {
      let msg = "Authentication failed.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") msg = "Incorrect email or password.";
      if (err.code === "auth/email-already-in-use") msg = "Email is already in use.";
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

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

                <TouchableOpacity onPress={handleToggleMode} style={styles.toggleBtn}>
                  <Text style={styles.toggleText}>
                    {isSignUp 
                      ? "Already have an account? Sign In" 
                      : "Don't have an account? Sign Up"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>

            {/* Forgot Password — only visible in Sign In mode */}
            {!isSignUp && (
              <TouchableOpacity style={styles.forgotBtn} onPress={openResetModal}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

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
                  <Text style={styles.modalTitle}>Check Your Inbox</Text>
                  <Text style={styles.modalSubtitle}>
                    A password reset link has been sent to{"\n"}
                    <Text style={{ color: THEME.ACCENT, fontWeight: "700" }}>{resetEmail}</Text>
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
  errorText: {
    color: THEME.ERROR,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: THEME.ACCENT,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  toggleBtn: {
    marginTop: 16,
    alignItems: "center",
  },
  toggleText: {
    color: THEME.MUTED,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  // Forgot Password link
  forgotBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  forgotText: {
    color: THEME.ACCENT,
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
});
