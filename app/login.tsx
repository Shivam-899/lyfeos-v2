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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

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

  return (
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
  guestBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  guestText: {
    color: THEME.MUTED,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
