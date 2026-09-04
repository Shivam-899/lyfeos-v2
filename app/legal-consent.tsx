import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import firestore from '@react-native-firebase/firestore';

const CONSENT_VERSION = '1.0';

const THEME = {
  BG: '#0F0F0F',
  CARD: '#1A1A1A',
  CARD_BORDER: '#2A2A2A',
  TEXT: '#FFFFFF',
  MUTED: '#A1A1AA',
  ACCENT: '#FF6B35',
};

export default function LegalConsentScreen() {
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [healthDisclaimerAccepted, setHealthDisclaimerAccepted] = useState(false);

  const allAccepted = termsAccepted && privacyAccepted && healthDisclaimerAccepted;

  const handleContinue = async () => {
    if (!allAccepted) return;
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const consentData = {
        accepted: true,
        version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem('legalConsent', JSON.stringify(consentData));

      // Also save to Firestore for non-guest authenticated users
      if (!isGuest && user) {
        try {
          await firestore()
            .collection('users')
            .doc(user.uid)
            .collection('data')
            .doc('consent')
            .set(consentData);
        } catch (firestoreErr) {
          // Non-fatal — local consent is already saved above
          console.log('Firestore consent save failed (non-fatal):', firestoreErr);
        }
      }

      router.replace('/(tabs)');
    } catch (e) {
      console.log('Consent save error:', e);
    }
  };

  const CheckboxRow = ({
    checked,
    onPress,
    label,
    linkText,
    linkUrl,
  }: {
    checked: boolean;
    onPress: () => void;
    label: string;
    linkText?: string;
    linkUrl?: string;
  }) => (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>
        {label}{' '}
        {linkText && linkUrl && (
          <Text style={styles.linkText} onPress={(e) => { e.stopPropagation(); Linking.openURL(linkUrl); }}>
            {linkText}
          </Text>
        )}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoText}>🌿 LyfeOS</Text>
          <Text style={styles.title}>Before You Continue</Text>
          <Text style={styles.subtitle}>
            Please review and accept the following to use LyfeOS
          </Text>
        </View>

        {/* Disclaimer Card */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>⚠️ Health & AI Disclaimer</Text>
          <Text style={styles.disclaimerText}>
            LyfeOS provides AI-generated nutrition estimates, calorie calculations, and activity
            insights for informational purposes only. This is NOT medical advice. Always consult a
            qualified healthcare professional before making health, dietary, or fitness decisions,
            especially if you have existing medical conditions.
          </Text>
        </View>

        {/* Checkboxes */}
        <View style={styles.checkboxSection}>
          <CheckboxRow
            checked={termsAccepted}
            onPress={() => setTermsAccepted(v => !v)}
            label="I agree to the"
            linkText="Terms of Service"
            linkUrl="https://lyfeos.web.app/terms-of-service"
          />
          <CheckboxRow
            checked={privacyAccepted}
            onPress={() => setPrivacyAccepted(v => !v)}
            label="I agree to the"
            linkText="Privacy Policy"
            linkUrl="https://lyfeos.web.app/privacy-policy"
          />
          <CheckboxRow
            checked={healthDisclaimerAccepted}
            onPress={() => setHealthDisclaimerAccepted(v => !v)}
            label="I understand and accept the Health & AI Disclaimer above"
          />
        </View>
      </ScrollView>

      {/* Sticky footer with Continue button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 24 }]}>
        <TouchableOpacity
          style={[styles.continueButton, !allAccepted && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!allAccepted}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue to LyfeOS</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          By continuing, you confirm you are 13 years of age or older.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.BG,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.ACCENT,
    fontFamily: 'Inter_700Bold',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.TEXT,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: THEME.MUTED,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  disclaimerCard: {
    backgroundColor: '#1E0D00',
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: THEME.ACCENT + '55',
  },
  disclaimerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.ACCENT,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  disclaimerText: {
    fontSize: 14,
    color: '#D4B5A0',
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  checkboxSection: {
    borderTopWidth: 1,
    borderTopColor: THEME.CARD_BORDER,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: THEME.CARD_BORDER,
    gap: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: THEME.ACCENT,
    borderColor: THEME.ACCENT,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    includeFontPadding: false,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: THEME.TEXT,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  linkText: {
    color: THEME.ACCENT,
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.CARD_BORDER,
    backgroundColor: THEME.BG,
  },
  continueButton: {
    backgroundColor: THEME.ACCENT,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: THEME.ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#333',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  footerNote: {
    fontSize: 12,
    color: THEME.MUTED,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
});
