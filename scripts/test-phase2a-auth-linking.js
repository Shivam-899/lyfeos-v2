// @ts-check
/**
 * scripts/test-phase2a-auth-linking.js
 *
 * Focused automated test suite for LYFEOS — P1-9 PHASE 2A:
 * Anonymous Auth Lifecycle + Safe New Account Conversion (Finding #3)
 *
 * TEST CLASSIFICATION: LOCAL MOCK/UNIT
 * NOTE: These tests verify client logic branching, state transitions, UID preservation,
 * and migration suppression using mocked Firebase Auth interfaces. They do not claim
 * to prove live Firebase Auth backend/network behavior.
 */

const assert = require('node:assert');
const test = require('node:test');

/**
 * Creates an isolated harness reproducing the AuthContext Phase 2A logic.
 */
function createAuthHarness(initialUser = null) {
  let currentUser = initialUser;
  let contextUser = initialUser;
  const calls = {
    linkWithCredential: [],
    createUserWithEmailAndPassword: [],
    signInWithEmailAndPassword: [],
    signInWithCredential: [],
    handleGuestMigration: [],
    userDelete: [],
    logEvent: [],
    logError: [],
  };

  const createMockUser = (uid, isAnonymous, displayName = null) => ({
    uid,
    isAnonymous,
    displayName,
    updateProfile: async ({ displayName: name }) => {
      displayName = name;
      if (currentUser && currentUser.uid === uid) {
        currentUser.displayName = name;
      }
    },
    delete: async () => {
      calls.userDelete.push(uid);
      if (currentUser && currentUser.uid === uid) {
        currentUser = null;
      }
    },
    linkWithCredential: async (credential) => {
      calls.linkWithCredential.push({ uid, credential });
      if (credential._failWith) {
        const err = new Error(credential._failWith.message || 'Linking failed');
        // @ts-ignore
        err.code = credential._failWith.code;
        throw err;
      }
      // Successful linking converts the anonymous account in-place:
      // UID remains the same, isAnonymous becomes false
      isAnonymous = false;
      const linkedUser = createMockUser(uid, false, displayName);
      currentUser = linkedUser;
      return { user: linkedUser };
    },
  });

  if (initialUser) {
    currentUser = createMockUser(initialUser.uid, initialUser.isAnonymous, initialUser.displayName);
    contextUser = currentUser;
  }

  const mockAuth = {
    currentUser: () => currentUser,
    EmailAuthProvider: {
      credential: (email, password) => ({
        providerId: 'password',
        email,
        password,
        _failWith: email.includes('alreadyinuse') ? { code: 'auth/credential-already-in-use', message: 'Email already in use' } : null,
      }),
    },
    GoogleAuthProvider: {
      credential: (idToken) => ({
        providerId: 'google.com',
        idToken,
        _failWith: idToken === 'token_existing_user' ? { code: 'auth/credential-already-in-use', message: 'Credential already in use' } : null,
      }),
    },
    createUserWithEmailAndPassword: async (email, password) => {
      calls.createUserWithEmailAndPassword.push({ email, password });
      const newUser = createMockUser('new_email_uid_101', false);
      currentUser = newUser;
      return { user: newUser };
    },
    signInWithEmailAndPassword: async (email, password) => {
      calls.signInWithEmailAndPassword.push({ email, password });
      const existingUser = createMockUser('existing_email_uid_202', false);
      currentUser = existingUser;
      return { user: existingUser };
    },
    signInWithCredential: async (credential) => {
      calls.signInWithCredential.push(credential);
      const googleUser = createMockUser('google_user_uid_303', false);
      currentUser = googleUser;
      return { user: googleUser };
    },
  };

  const handleGuestMigration = async (newUid, wasAnonymous) => {
    calls.handleGuestMigration.push({ newUid, wasAnonymous });
    if (!wasAnonymous) return;
  };

  const logEvent = async (name, params) => {
    calls.logEvent.push({ name, params });
  };

  const logError = (err, context) => {
    calls.logError.push({ err, context });
  };

  const setUser = (u) => {
    contextUser = u;
  };

  // ── Implement AuthContext Phase 2A Functions Under Test ─────────────────────

  const signUpWithEmail = async (name, email, password) => {
    try {
      const anonUser = mockAuth.currentUser();
      const isAnon = anonUser?.isAnonymous === true;

      if (isAnon && anonUser) {
        const credential = mockAuth.EmailAuthProvider.credential(email, password);
        const result = await anonUser.linkWithCredential(credential);
        if (result.user) {
          await result.user.updateProfile({ displayName: name });
          setUser({ ...result.user, displayName: name });
        }
        await logEvent('sign_up', { method: 'email' });
        return;
      }

      const result = await mockAuth.createUserWithEmailAndPassword(email, password);
      if (result.user) {
        await result.user.updateProfile({ displayName: name });
        setUser({ ...result.user, displayName: name });
      }
      await handleGuestMigration(result.user.uid, false);
      await logEvent('sign_up', { method: 'email' });
    } catch (e) {
      logError(e, 'signUpWithEmail');
      throw e;
    }
  };

  const signInWithGoogle = async (idToken = 'valid_token_new') => {
    try {
      const anonUser = mockAuth.currentUser();
      const isAnon = anonUser?.isAnonymous === true;

      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = mockAuth.GoogleAuthProvider.credential(idToken);

      if (isAnon && anonUser) {
        try {
          const result = await anonUser.linkWithCredential(googleCredential);
          if (result.user) {
            setUser(result.user);
          }
          await logEvent('sign_up', { method: 'google' });
          return;
        } catch (linkError) {
          logError(linkError, 'signInWithGoogle:linkWithCredential');
          throw linkError;
        }
      }

      const result = await mockAuth.signInWithCredential(googleCredential);
      await handleGuestMigration(result.user.uid, false);
      await logEvent('login', { method: 'google' });
    } catch (e) {
      logError(e, 'signInWithGoogle');
      throw e;
    }
  };

  return {
    mockAuth,
    calls,
    getCurrentUser: () => currentUser,
    getContextUser: () => contextUser,
    signUpWithEmail,
    signInWithGoogle,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2A AUTOMATED TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 1: [LOCAL MOCK/UNIT] Anonymous + new email account → link path selected', async () => {
  const harness = createAuthHarness({ uid: 'anon_user_1', isAnonymous: true });

  await harness.signUpWithEmail('Alice', 'alice@newdomain.com', 'password123');

  // Verify linkWithCredential was called on the anonymous user
  assert.strictEqual(harness.calls.linkWithCredential.length, 1, 'linkWithCredential should be called exactly once');
  assert.strictEqual(harness.calls.linkWithCredential[0].uid, 'anon_user_1', 'linkWithCredential should target anonymous UID');
  assert.strictEqual(harness.calls.createUserWithEmailAndPassword.length, 0, 'createUserWithEmailAndPassword must NOT be called');
});

test('TEST 2: [LOCAL MOCK/UNIT] Anonymous + new Google account → link path selected', async () => {
  const harness = createAuthHarness({ uid: 'anon_user_2', isAnonymous: true });

  await harness.signInWithGoogle('valid_token_new');

  // Verify linkWithCredential was called on the anonymous user
  assert.strictEqual(harness.calls.linkWithCredential.length, 1, 'linkWithCredential should be called for new Google auth');
  assert.strictEqual(harness.calls.linkWithCredential[0].uid, 'anon_user_2', 'linkWithCredential should target anonymous UID');
  assert.strictEqual(harness.calls.signInWithCredential.length, 0, 'signInWithCredential must NOT be called for new Google account');
});

test('TEST 3: [LOCAL MOCK/UNIT] Successful linking preserves UID', async () => {
  const originalUid = 'anon_persistent_uid_42';
  const harness = createAuthHarness({ uid: originalUid, isAnonymous: true });

  await harness.signUpWithEmail('Bob', 'bob@test.com', 'password123');

  const finalUser = harness.getCurrentUser();
  const contextUser = harness.getContextUser();

  assert.strictEqual(finalUser.uid, originalUid, 'Firebase Auth user UID must be preserved after linking');
  assert.strictEqual(contextUser.uid, originalUid, 'Context user UID must be preserved after linking');
  assert.strictEqual(finalUser.isAnonymous, false, 'User must no longer be anonymous after linking');
  assert.strictEqual(contextUser.isAnonymous, false, 'Context user must no longer be anonymous after linking');
});

test('TEST 4: [LOCAL MOCK/UNIT] Successful linking does not trigger duplicate guest migration', async () => {
  const harness = createAuthHarness({ uid: 'anon_user_4', isAnonymous: true });

  await harness.signUpWithEmail('Carol', 'carol@test.com', 'password123');

  // UID is preserved, so local data remains attached without duplicate migration call
  assert.strictEqual(harness.calls.handleGuestMigration.length, 0, 'handleGuestMigration must NOT be called upon successful linking');
});

test('TEST 5: [LOCAL MOCK/UNIT] Credential already in use → existing-account path is NOT silently migrated', async () => {
  const harness = createAuthHarness({ uid: 'anon_user_5', isAnonymous: true });

  // Attempting to link with an existing email/credential
  await assert.rejects(
    async () => {
      await harness.signUpWithEmail('David', 'alreadyinuse@test.com', 'password123');
    },
    (err) => {
      assert.strictEqual(err.code, 'auth/credential-already-in-use');
      return true;
    },
    'Should re-throw credential-already-in-use error'
  );

  // Assert no migration or silent switch occurred
  assert.strictEqual(harness.calls.handleGuestMigration.length, 0, 'Migration must NOT be invoked when credential in use');
  assert.strictEqual(harness.calls.signInWithEmailAndPassword.length, 0, 'Must not silently sign in with password');
  assert.strictEqual(harness.calls.createUserWithEmailAndPassword.length, 0, 'Must not create a new user');
  assert.strictEqual(harness.getCurrentUser().uid, 'anon_user_5', 'Anonymous session must remain active');
  assert.strictEqual(harness.getCurrentUser().isAnonymous, true, 'User must remain anonymous');
});

test('TEST 6: [LOCAL MOCK/UNIT] Linking failure preserves guest data/session where possible', async () => {
  const harness = createAuthHarness({ uid: 'anon_user_6', isAnonymous: true });

  // Attempt to link with Google credential that belongs to existing user
  await assert.rejects(
    async () => {
      await harness.signInWithGoogle('token_existing_user');
    },
    (err) => {
      assert.strictEqual(err.code, 'auth/credential-already-in-use');
      return true;
    }
  );

  // Verify anonymous user state and identity were completely preserved
  assert.strictEqual(harness.getCurrentUser().uid, 'anon_user_6', 'Anonymous UID preserved on linking failure');
  assert.strictEqual(harness.getCurrentUser().isAnonymous, true, 'Anonymous flag preserved on linking failure');
  assert.strictEqual(harness.calls.userDelete.length, 0, 'User.delete must NOT be called on failure');
});

test('TEST 7: [LOCAL MOCK/UNIT] No anonymous deletion occurs before successful linking', async () => {
  const harness = createAuthHarness({ uid: 'anon_user_7', isAnonymous: true });

  // Link successfully
  await harness.signUpWithEmail('Eva', 'eva@test.com', 'password123');

  // Verify user.delete was never called at any point in the lifecycle
  assert.strictEqual(harness.calls.userDelete.length, 0, 'Anonymous user must never be deleted when converting via linking');
});

test('TEST 8: [LOCAL MOCK/UNIT] Non-anonymous direct sign-in behavior remains unchanged', async () => {
  // Start with fresh non-anonymous state (no previous session)
  const harness = createAuthHarness(null);

  // Fresh user signs up
  await harness.signUpWithEmail('Frank', 'frank@test.com', 'password123');

  assert.strictEqual(harness.calls.linkWithCredential.length, 0, 'linkWithCredential must not be called when user was not anonymous');
  assert.strictEqual(harness.calls.createUserWithEmailAndPassword.length, 1, 'createUserWithEmailAndPassword must be called for non-guest');
  assert.strictEqual(harness.calls.handleGuestMigration.length, 1, 'handleGuestMigration called with wasAnonymous=false');
  assert.strictEqual(harness.calls.handleGuestMigration[0].wasAnonymous, false, 'wasAnonymous flag must be false');
});
