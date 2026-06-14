import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { View } from "react-native";

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
    // IMPORTANT: Replace this with your actual Web Client ID from Firebase Console
    // → Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration → Web client ID
    // Also ensure google-services.json has your OAuth client registered (oauth_client array must not be empty)
    const WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com";
    if (WEB_CLIENT_ID.startsWith("YOUR_")) {
      console.warn(
        "[AuthContext] Google Sign-In is NOT configured. " +
        "Replace WEB_CLIENT_ID in AuthContext.tsx with your actual Firebase Web Client ID."
      );
    }
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });

    // Auth state listener:
    const subscriber = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return subscriber; // unsubscribe on unmount
  }, []);

  const signInWithGoogle = async () => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { data } = await GoogleSignin.signIn();
    const idToken = data?.idToken;

    if (!idToken) {
      throw new Error("No ID token found");
    }

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await auth().signInWithEmailAndPassword(email, password);
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const result = await auth().createUserWithEmailAndPassword(email, password);
    if (result.user) {
      await result.user.updateProfile({ displayName: name });
      // Update local user state immediately to reflect the new display name
      setUser({ ...result.user, displayName: name } as FirebaseAuthTypes.User);
    }
  };

  const signInAsGuest = async () => {
    await auth().signInAnonymously();
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
