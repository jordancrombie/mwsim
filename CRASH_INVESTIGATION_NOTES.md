# P2P Tab Crash Investigation Notes

## The Problem
- App crashes when tapping the P2P tab **after a user has completed at least one P2P transfer**
- New users work perfectly until their first transfer, then crash every time on P2P tab
- Crash also happens when returning to P2P tab after completing a transfer (tapping "Done")

## Key Observation
The crash ONLY happens when there are actual Transfer objects to display. Empty transfer list = no crash.

## What We Tried (None of These Worked)

### Build 37-38: SecureStore try-catch protection
- Added try-catch to all SecureStore operations
- **Result**: Still crashed - native exceptions bypass JavaScript try-catch

### Build 39: Disabled New Architecture
- Set `newArchEnabled: false` in app.json
- **Result**: Still crashed - crash type changed from TurboModule to RCTExceptionsManager

### Build 40: Added try-catch to axios interceptors
- Wrapped interceptors in try-catch
- **Result**: Still crashed - can't catch native-level exceptions

### Build 41: Removed SecureStore from P2P flow
- Added in-memory `setP2PAuthContext()` and `clearP2PAuthContext()`
- TransferSim interceptor uses memory instead of SecureStore
- **Result**: Still crashed - main API interceptor also used SecureStore

### Build 42: Removed SecureStore from ALL API interceptors
- Added `setCachedAccessToken()` and `setCachedRefreshToken()` in api.ts
- Both main API and TransferSim use in-memory tokens
- Tokens read from SecureStore ONCE at startup, cached in memory
- **Result**: Still crashed

### Build 43: Added global error handler and detailed logging
- Added `ErrorUtils.setGlobalHandler()` to catch JS errors and show Alert
- Added extensive console.log in loadP2PData()
- **Result**: Still crashed - NO ALERT shown, meaning crash is at native level before JS sees it

## What The Crash Reports Show
- `RCTFatal` + `RCTExceptionsManager reportFatal`
- `objc_exception_rethrow` - native Objective-C exception
- Happens on background thread (Thread 3 or 5), not main thread
- Crash is in React Native's native module invocation: `facebook::react::invokeInner`
- JavaScript error handlers CANNOT catch this - it's a native crash

## The Root Cause Theory
Looking at the changelog, the crashes started around Build 28-30 when we added:
1. **Build 28**: "Bank accounts now refresh when switching to P2P tab" + "SecureStorage cleared on logout"
2. **Build 29**: P2P auth changed to use `fiUserRef:bsimId` instead of `userId:bsimId`
3. **Build 30**: More aggressive refreshing - "Account balances refresh on Done button"

The pattern of "reload everything on every tab switch" combined with SecureStore access in interceptors seems to trigger a React Native bug on iOS 26.

## Current Approach: Rollback and Roll Forward

### Build 44 (Current)
- Rolled back `app/` folder to commit `f02c151` (Micro Merchant UI, before the crash-causing changes)
- This is the state BEFORE Build 28-30 changes
- Set `newArchEnabled: false`
- Added `withXcodeOptimizations` plugin

### If Build 44 Works
We know the problem was introduced in commits after f02c151. The problematic commits are:
- `9ccde07` - Build 29: fiUserRef auth change
- `6ac8f90` - Build 30: balance refresh on Done
- `b19ee36` - Build 31: first crash "fix"
- `d9b1ac1` - Build 32: more crash "fixes"
- `7ad0178` - Build 33: TurboModule crash "fixes"

We should carefully review what ACTUALLY needs to be added back and do it minimally.

## Key Files Involved
- `/app/App.tsx` - Main app with P2P tab, loadP2PData(), checkP2PEnrollment()
- `/app/src/services/transferSim.ts` - TransferSim API client with interceptors
- `/app/src/services/api.ts` - Main WSIM API client with interceptors
- `/app/src/services/secureStorage.ts` - SecureStore wrapper

## What NOT To Do
1. DO NOT add more SecureStore "fixes" - the problem isn't SecureStore itself
2. DO NOT add more try-catch - native exceptions can't be caught in JS
3. DO NOT keep layering "fixes" on top of broken code
4. DO NOT chase symptoms - find the actual breaking change

## What To Do Instead
1. Test Build 44 - if it works, the rollback approach is correct
2. If Build 44 works, carefully cherry-pick ONLY essential changes from later commits
3. Test after EACH change to identify exactly which change breaks it
4. Avoid aggressive data refreshing patterns that may trigger the bug

## Git References
- Last known good: `f02c151` (Micro Merchant UI)
- First crash reports: Build 31 (`b19ee36`)
- Stashed changes: `git stash list` to see, `git stash pop` to restore if needed

---

## Rolling Forward Testing (Jan 2, 2026)

### Build 47: Build 29 code with `newArchEnabled: false`
- Clean checkout of Build 29 (`9ccde07`) code
- Set `newArchEnabled: false`
- **Result**: CRASH - still crashes

### Build 48: TRUE Build 29 clone with `newArchEnabled: true`
- Exact Build 29 code including `api.ts` with `fiUserRef` in `getEnrolledBanks`
- `newArchEnabled: true` (matching original Build 29)
- **Result**: CRASH - but Reset Device started working again
- This confirms the crash is in the Build 29 CODE changes, not `newArchEnabled`

### Build 49: Clean Build 22 baseline with `newArchEnabled: true`
- Rolled back to `f02c151` (Build 22) code
- `newArchEnabled: true`
- Only differences from original Build 22: build number + `withXcodeOptimizations` plugin
- **Result**: WORKS! No crash.
- **Issue**: Existing P2P enrolled user (mobile@banksim.ca) is not detected as enrolled
  - This is expected because Build 22 uses `userId:bsimId` auth, but API now requires `fiUserRef:bsimId`
  - User shows "Enroll" prompt instead of showing their existing aliases/transfers

### Next Steps
1. Build 50: Add fiUserRef auth changes from Build 29 (needed for API compatibility)
   - Changes to: `secureStorage.ts`, `transferSim.ts`, `api.ts`, and P2PUserContext calls in `App.tsx`
   - Do NOT add the massive logout state reset
   - Do NOT add `loadP2PData()` on P2P tab switch
2. Test if Build 50 works with existing enrolled users
3. If it crashes, the fiUserRef changes are the problem
4. If it works, incrementally add other Build 29 changes

### Key Insight
The crash is somewhere in Build 29's changes:
1. Massive logout state reset (~40+ state variables cleared)
2. fiUserRef auth changes
3. `loadP2PData()` called when switching to P2P tab while already enrolled

Build 22 code (Build 49) works but can't authenticate properly with current backend.

### Build 50: Build 22 + fiUserRef auth changes ONLY
- Base: Build 22 (`f02c151`)
- Added ONLY the fiUserRef auth changes:
  - `secureStorage.ts`: Added `fiUserRef` to `P2PUserContext` interface
  - `transferSim.ts`: Changed auth header from `userId:bsimId` to `fiUserRef:bsimId`
  - `api.ts`: Added `fiUserRef` to `getEnrolledBanks()` return type
  - `App.tsx`: Updated `checkP2PEnrollment()` and P2P enrollment to use `fiUserRef`
- Did NOT add: massive logout state reset, `loadP2PData()` on tab switch
- **Result**: (pending test)

### Why fiUserRef is needed
WSIM backend returns `fiUserRef` (BSIM internal user ID) in `/mobile/enrollment/list`.
TransferSim requires `fiUserRef:bsimId` for auth, not `userId:bsimId`.
Without this, existing P2P enrolled users can't authenticate and appear unenrolled.

---

## ROOT CAUSE IDENTIFIED (Jan 3, 2026)

### The Smoking Gun
In Build 29 (`9ccde07`), the following code was added to the P2P tab button press handler:

```typescript
} else if (p2pEnrolled && !p2pLoading) {
  // Refresh P2P data (accounts, aliases, transfers) when switching to tab
  loadP2PData();
}
```

**This causes `loadP2PData()` to be called EVERY TIME the user switches to the P2P tab** when already enrolled.

### Why This Causes a Crash

1. User completes a P2P transfer (now has transfer history)
2. User taps "Done" which calls `setActiveHomeTab('p2p')` and `setCurrentScreen('home')`
3. The P2P tab button's `onPress` handler fires (because we're setting it active)
4. Since `p2pEnrolled === true` and `!p2pLoading`, it calls `loadP2PData()`
5. `loadP2PData()` calls `setRecentTransfers(transfersResult.transfers || [])`
6. React attempts to render the transfer list while data is still being fetched/processed
7. The render accesses properties like `transfer.direction`, `transfer.createdAt`, `transfer.amount`
8. If any of these are undefined/malformed during the state transition, React Native's TurboModule bridge crashes

### Why It Only Crashes When Transfers Exist
- Empty array = `.map()` produces nothing = no property access = no crash
- Array with transfers = `.map()` iterates = property access on potentially malformed data = crash

### The Fix
Remove the problematic `loadP2PData()` call on tab switch. The data was already loaded when checking enrollment and can be refreshed via pull-to-refresh if needed.

The massive 40+ state variable reset on logout is fine to keep (prevents stale data).
The fiUserRef auth changes are required for API compatibility.
