import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { View } from "react-native";
import { logEvent, logError } from "@/utils/analytics";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  isInitializing: boolean; // Kept for backward compatibility with existing layout routing
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: "66808080139-r6t78lrsqsoabug2jlrltb1bbevt2003.apps.googleusercontent.com",
    });

    // Auth state listener:
    const subscriber = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return subscriber; // unsubscribe on unmount
  }, []);

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;

      if (!idToken) {
        throw new Error("No ID token found");
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      await logEvent("login", { method: "google" });
    } catch (e) {
      logError(e as Error, "signInWithGoogle");
      throw e;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      await logEvent("login", { method: "email" });
    } catch (e) {
      logError(e as Error, "signInWithEmail");
      throw e;
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    try {
      const result = await auth().createUserWithEmailAndPassword(email, password);
      if (result.user) {
        await result.user.updateProfile({ displayName: name });
        // Update local user state immediately to reflect the new display name
        setUser({ ...result.user, displayName: name } as FirebaseAuthTypes.User);
      }
      await logEvent("sign_up", { method: "email" });
    } catch (e) {
      logError(e as Error, "signUpWithEmail");
      throw e;
    }
  };

  const signInAsGuest = async () => {
    try {
      await auth().signInAnonymously();
      await logEvent("login", { method: "guest" });
    } catch (e) {
      logError(e as Error, "signInAsGuest");
      throw e;
    }
  };

  const signOut = async () => {
    await auth().signOut();
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  };

  const isGuest = user?.isAnonymous ?? false;

  // Removed blocking loading view to allow Expo Router to mount
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isInitializing: loading,
        isGuest,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
