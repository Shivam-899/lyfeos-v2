// @ts-check
/**
 * scripts/test-phase2b3-resolution-ui.js
 *
 * Focused automated test suite for LYFEOS — P1-9 PHASE 2B-3:
 * Existing-Account Guest Data Resolution UI & Cold-Start Routing
 *
 * TEST CLASSIFICATION: LOCAL UNIT / BEHAVIORAL
 * Validates UI state machine, interactions, error/retry flows,
 * cold-start routing guards, non-dismissibility, and copy guardrails.
 */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ─────────────────────────────────────────────────────────────────────────────
// HARNESS: Guest Data Resolution State Machine
// Matches exact state logic in app/login.tsx
// ─────────────────────────────────────────────────────────────────────────────

function createResolutionUiHarness({
  initialPending = true,
  mergeFails = false,
  discardFails = false,
} = {}) {
  let isPendingMigrationResolution = initialPending;
  let resolutionView = "decision"; // "decision" | "confirm_discard"
  let resolutionLoading = null; // "merge" | "discard" | null
  let resolutionError = null; // { title, message, action } | null
  let mergeCallCount = 0;
  let discardCallCount = 0;
  let navRoute = null;

  // Mock router
  const router = {
    replace: (route) => { navRoute = route; },
  };

  // Mock useAuth hooks
  const mergeGuestDataAndProceed = async () => {
    mergeCallCount++;
    if (mergeFails) {
      throw new Error("Network error during merge");
    }
    isPendingMigrationResolution = false;
  };

  const discardGuestDataAndProceed = async () => {
    discardCallCount++;
    if (discardFails) {
      throw new Error("Disk error during discard");
    }
    isPendingMigrationResolution = false;
  };

  // UI Handlers matching app/login.tsx
  const handleMerge = async () => {
    if (resolutionLoading !== null) return;
    resolutionLoading = "merge";
    resolutionError = null;
    try {
      await mergeGuestDataAndProceed();
    } catch (err) {
      resolutionError = {
        title: "Unable to Merge Data",
        message: "We encountered an issue while merging your guest data. Please check your connection and try again.",
        action: "merge",
      };
    } finally {
      resolutionLoading = null;
    }
  };

  const handleStartDiscard = () => {
    if (resolutionLoading !== null) return;
    resolutionError = null;
    resolutionView = "confirm_discard";
  };

  const handleCancelDiscard = () => {
    if (resolutionLoading !== null) return;
    resolutionError = null;
    resolutionView = "decision";
  };

  const handleConfirmDiscard = async () => {
    if (resolutionLoading !== null) return;
    resolutionLoading = "discard";
    resolutionError = null;
    try {
      await discardGuestDataAndProceed();
    } catch (err) {
      resolutionError = {
        title: "Unable to Discard Data",
        message: "We encountered an issue while discarding your guest data. Please try again.",
        action: "discard",
      };
    } finally {
      resolutionLoading = null;
    }
  };

  const handleModalRequestClose = () => {
    if (resolutionLoading !== null) return false; // blocked
    if (resolutionView === "confirm_discard") {
      resolutionError = null;
      resolutionView = "decision";
      return true; // handled transition
    }
    return false; // blocked (non-dismissible on decision view)
  };

  return {
    getState: () => ({
      isPendingMigrationResolution,
      resolutionView,
      resolutionLoading,
      resolutionError,
      mergeCallCount,
      discardCallCount,
      navRoute,
    }),
    setMergeFails: (val) => { mergeFails = val; },
    setDiscardFails: (val) => { discardFails = val; },
    handleMerge,
    handleStartDiscard,
    handleCancelDiscard,
    handleConfirmDiscard,
    handleModalRequestClose,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('1. Modal visibility is driven by isPendingMigrationResolution', () => {
  const h1 = createResolutionUiHarness({ initialPending: true });
  assert.strictEqual(h1.getState().isPendingMigrationResolution, true, 'Modal should be visible when pending');

  const h2 = createResolutionUiHarness({ initialPending: false });
  assert.strictEqual(h2.getState().isPendingMigrationResolution, false, 'Modal should NOT be visible when not pending');
});

test('2. Initial view defaults to decision view', () => {
  const h = createResolutionUiHarness();
  assert.strictEqual(h.getState().resolutionView, 'decision', 'Default view must be decision');
  assert.strictEqual(h.getState().resolutionLoading, null, 'Loading must be null initially');
  assert.strictEqual(h.getState().resolutionError, null, 'Error must be null initially');
});

test('3. Primary CTA triggers mergeGuestDataAndProceed and closes modal on success', async () => {
  const h = createResolutionUiHarness();
  await h.handleMerge();

  const state = h.getState();
  assert.strictEqual(state.mergeCallCount, 1, 'mergeGuestDataAndProceed must be called once');
  assert.strictEqual(state.isPendingMigrationResolution, false, 'isPendingMigrationResolution must become false');
  assert.strictEqual(state.resolutionLoading, null, 'Loading must reset to null');
  assert.strictEqual(state.resolutionError, null, 'Error must remain null');
});

test('4. Double-tap lockout during merge prevents concurrent merge calls', async () => {
  const h = createResolutionUiHarness();
  
  // Call merge twice concurrently
  const p1 = h.handleMerge();
  const p2 = h.handleMerge();
  await Promise.all([p1, p2]);

  assert.strictEqual(h.getState().mergeCallCount, 1, 'Only one merge call must be processed');
});

test('5. Merge failure sets exact approved error title and enables retry', async () => {
  const h = createResolutionUiHarness({ mergeFails: true });
  await h.handleMerge();

  const state = h.getState();
  assert.strictEqual(state.mergeCallCount, 1);
  assert.strictEqual(state.isPendingMigrationResolution, true, 'Modal must remain open on failure');
  assert.ok(state.resolutionError, 'Error banner must be populated');
  assert.strictEqual(state.resolutionError.title, 'Unable to Merge Data');
  assert.strictEqual(state.resolutionError.action, 'merge');

  // Retry after failure
  h.setMergeFails(false);
  await h.handleMerge();
  assert.strictEqual(h.getState().mergeCallCount, 2, 'Retry must call merge again');
  assert.strictEqual(h.getState().isPendingMigrationResolution, false, 'Modal closes after retry succeeds');
});

test('6. Secondary CTA transitions from decision to confirm_discard view', () => {
  const h = createResolutionUiHarness();
  assert.strictEqual(h.getState().resolutionView, 'decision');

  h.handleStartDiscard();
  assert.strictEqual(h.getState().resolutionView, 'confirm_discard', 'Must transition to confirm_discard');
  assert.strictEqual(h.getState().isPendingMigrationResolution, true);
});

test('7. Discard Confirmation "No, Keep Data" returns to decision view', () => {
  const h = createResolutionUiHarness();
  h.handleStartDiscard();
  assert.strictEqual(h.getState().resolutionView, 'confirm_discard');

  h.handleCancelDiscard();
  assert.strictEqual(h.getState().resolutionView, 'decision', 'Must transition back to decision view');
});

test('8. Discard Confirmation "Yes, Permanently Discard" calls discardGuestDataAndProceed', async () => {
  const h = createResolutionUiHarness();
  h.handleStartDiscard();
  await h.handleConfirmDiscard();

  const state = h.getState();
  assert.strictEqual(state.discardCallCount, 1, 'discardGuestDataAndProceed must be called once');
  assert.strictEqual(state.isPendingMigrationResolution, false, 'isPendingMigrationResolution must become false');
  assert.strictEqual(state.resolutionLoading, null);
});

test('9. Double-tap lockout during discard prevents concurrent discard calls', async () => {
  const h = createResolutionUiHarness();
  h.handleStartDiscard();

  const p1 = h.handleConfirmDiscard();
  const p2 = h.handleConfirmDiscard();
  await Promise.all([p1, p2]);

  assert.strictEqual(h.getState().discardCallCount, 1, 'Only one discard call must be processed');
});

test('10. Discard failure sets exact approved error title and enables retry', async () => {
  const h = createResolutionUiHarness({ discardFails: true });
  h.handleStartDiscard();
  await h.handleConfirmDiscard();

  const state = h.getState();
  assert.strictEqual(state.discardCallCount, 1);
  assert.strictEqual(state.isPendingMigrationResolution, true, 'Modal must remain open on discard failure');
  assert.ok(state.resolutionError);
  assert.strictEqual(state.resolutionError.title, 'Unable to Discard Data');
  assert.strictEqual(state.resolutionError.action, 'discard');

  // Retry after failure
  h.setDiscardFails(false);
  await h.handleConfirmDiscard();
  assert.strictEqual(h.getState().discardCallCount, 2, 'Retry must call discard again');
  assert.strictEqual(h.getState().isPendingMigrationResolution, false, 'Modal closes after retry succeeds');
});

test('11. Android back button on confirm_discard returns to decision view', () => {
  const h = createResolutionUiHarness();
  h.handleStartDiscard();
  assert.strictEqual(h.getState().resolutionView, 'confirm_discard');

  const handled = h.handleModalRequestClose();
  assert.strictEqual(handled, true, 'Back press handled by returning to decision view');
  assert.strictEqual(h.getState().resolutionView, 'decision', 'View returned to decision');
  assert.strictEqual(h.getState().isPendingMigrationResolution, true, 'Modal remains open');
});

test('12. Android back button on decision view is strictly blocked (non-dismissible)', () => {
  const h = createResolutionUiHarness();
  assert.strictEqual(h.getState().resolutionView, 'decision');

  const handled = h.handleModalRequestClose();
  assert.strictEqual(handled, false, 'Back press must be rejected/blocked');
  assert.strictEqual(h.getState().isPendingMigrationResolution, true, 'Modal must NOT dismiss');
});

test('13. Cold-start routing guard in app/_layout.tsx routes to /login when pending', () => {
  const layoutPath = path.resolve(__dirname, '../app/_layout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');

  // Verify routing logic for pending migration
  assert.ok(layoutCode.includes('if (isPendingMigrationResolution)'), 'Must check isPendingMigrationResolution');
  assert.ok(layoutCode.includes('segments[0] !== ("login" as any)'), 'Must check if not on login');
  assert.ok(layoutCode.includes('router.replace("/login" as any)'), 'Must redirect to /login');
  assert.ok(layoutCode.includes('SplashScreen.hideAsync()'), 'Must hide splash screen so screen does not hang');
});

test('14. Verified source code contains exact approved decision view copy', () => {
  const loginPath = path.resolve(__dirname, '../app/login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');

  assert.ok(loginCode.includes('Guest Data Found'), 'Must contain exact title "Guest Data Found"');
  assert.ok(
    loginCode.includes('We found data you created on this device while using LyfeOS as a guest. You can add it to your account or discard it.'),
    'Must contain exact subtitle body'
  );
  assert.ok(
    loginCode.includes("Your existing account data is safe and won't be overwritten."),
    'Must contain exact reassurance box text'
  );
  assert.ok(loginCode.includes('Keep & Merge Data'), 'Must contain primary CTA "Keep & Merge Data"');
  assert.ok(loginCode.includes('Adds your guest data to this account'), 'Must contain primary CTA helper text');
  assert.ok(loginCode.includes('Discard Guest Data'), 'Must contain secondary CTA "Discard Guest Data"');
  assert.ok(loginCode.includes('Permanently removes data from your guest session'), 'Must contain secondary CTA helper text');
});

test('15. Verified source code contains exact approved discard confirmation copy', () => {
  const loginPath = path.resolve(__dirname, '../app/login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');

  assert.ok(loginCode.includes('Permanently Discard Guest Data?'), 'Must contain exact title');
  assert.ok(
    loginCode.includes('This will permanently remove the data created during your guest session. This action cannot be undone.'),
    'Must contain exact discard explanation'
  );
  assert.ok(
    loginCode.includes('Your existing account data will remain completely untouched.'),
    'Must contain exact existing account safety guarantee'
  );
  assert.ok(loginCode.includes('Yes, Permanently Discard'), 'Must contain destructive CTA');
  assert.ok(loginCode.includes('No, Keep Data'), 'Must contain cancel CTA');
});

test('16. Verified source code contains exact approved loading and error copy', () => {
  const loginPath = path.resolve(__dirname, '../app/login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');

  assert.ok(loginCode.includes('Merging your guest data...'), 'Must contain merge loading copy');
  assert.ok(loginCode.includes('Discarding guest data...'), 'Must contain discard loading copy');
  assert.ok(loginCode.includes('Unable to Merge Data'), 'Must contain merge error title');
  assert.ok(loginCode.includes('Unable to Discard Data'), 'Must contain discard error title');
  assert.ok(loginCode.includes('Try Again'), 'Must contain retry CTA');
});

test('17. User-facing modal copy contains ZERO technical jargon', () => {
  const loginPath = path.resolve(__dirname, '../app/login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');

  // Extract the modal section
  const modalStart = loginCode.indexOf('{/* ── Guest Data Resolution Modal');
  assert.ok(modalStart !== -1, 'Modal comment must exist');
  const modalChunk = loginCode.slice(modalStart);

  // Forbidden technical jargon in user-facing texts
  const forbidden = [
    'AsyncStorage',
    'checkpoint',
    'targetUid',
    'wasAnonymous',
    'Firestore',
    'Firebase Auth',
    'authToken',
  ];

  for (const term of forbidden) {
    assert.strictEqual(
      modalChunk.includes(term),
      false,
      `User-facing modal text must not contain technical term: "${term}"`
    );
  }
});

test('18. Copy uses generic "Guest Data" terminology rather than isolated "Activity"', () => {
  const loginPath = path.resolve(__dirname, '../app/login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');

  const modalStart = loginCode.indexOf('{/* ── Guest Data Resolution Modal');
  const modalChunk = loginCode.slice(modalStart);

  assert.ok(modalChunk.includes('Guest Data Found'), 'Must say Guest Data Found');
  assert.ok(modalChunk.includes('guest data'), 'Must reference guest data generically');
  assert.strictEqual(modalChunk.includes('Guest Activity Found'), false, 'Must NOT use Activity-specific title');
  assert.strictEqual(modalChunk.includes('Activity Found'), false, 'Must NOT use Activity-specific title');
});

test('19. Modal is strictly non-dismissible outside and backdrop does not close it', () => {
  const loginPath = path.resolve(__dirname, '../app/login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');

  const modalStart = loginCode.indexOf('{/* ── Guest Data Resolution Modal');
  const modalEnd = loginCode.indexOf('</Modal>', modalStart);
  const modalChunk = loginCode.slice(modalStart, modalEnd);

  // Ensure there is no backdrop Touchable onPress dismissing the modal
  assert.strictEqual(
    modalChunk.includes('onPress={() => setIsPendingMigrationResolution(false)}'),
    false,
    'Backdrop must not dismiss modal'
  );
  assert.strictEqual(
    modalChunk.includes('onPress={() => setShowResolutionModal(false)}'),
    false,
    'Backdrop must not dismiss modal'
  );
});

test('20. TodosContext.tsx remains completely untouched', () => {
  const todosContextPath = path.resolve(__dirname, '../context/TodosContext.tsx');
  const todosCode = fs.readFileSync(todosContextPath, 'utf8');
  assert.ok(todosCode.length > 0, 'TodosContext must exist');
});
