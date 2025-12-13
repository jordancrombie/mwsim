# wsim Mobile API Proposal

**From:** mwsim Team
**To:** wsim Team
**Date:** 2024-12-13
**Status:** Draft - For Review

---

## Overview

This document proposes new API endpoints for the wsim backend to support the mwsim mobile wallet application. The mobile app requires specific endpoints optimized for:

1. Device registration and management
2. Biometric authentication
3. JWT-based token management
4. Mobile-optimized data responses

We've designed these endpoints to:
- Reuse existing wsim logic where possible
- Minimize changes to existing endpoints
- Follow wsim's existing patterns and security practices

---

## Proposed Database Schema Changes

Add to `backend/prisma/schema.prisma`:

```prisma
model MobileDevice {
  id               String   @id @default(uuid())
  userId           String
  user             WalletUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  deviceId         String   @unique  // Client-generated UUID
  platform         String   // "ios" or "android"
  deviceName       String
  pushToken        String?  // APNS or FCM token (future use)

  // Device credential for authentication
  deviceCredential String   // Encrypted server-issued token
  credentialExpiry DateTime

  // Biometric info
  biometricEnabled Boolean  @default(false)
  biometricType    String?  // "face" or "fingerprint"
  biometricPublicKey String? // For signature verification

  lastUsedAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  refreshTokens    MobileRefreshToken[]

  @@index([userId])
}

model MobileRefreshToken {
  id           String   @id @default(uuid())
  token        String   @unique
  userId       String
  user         WalletUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceId     String
  device       MobileDevice @relation(fields: [deviceId], references: [deviceId], onDelete: Cascade)

  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([deviceId])
}
```

**Migration notes:**
- Add relation to `WalletUser`: `mobileDevices MobileDevice[]`
- Add relation to `WalletUser`: `mobileRefreshTokens MobileRefreshToken[]`

---

## Proposed API Endpoints

All endpoints are prefixed with `/api/mobile/`.

### 1. Device Registration

**POST /api/mobile/device/register**

Register a mobile device with the wallet service.

```typescript
// Request
{
  "deviceId": "uuid-generated-on-device",
  "platform": "ios" | "android",
  "deviceName": "iPhone 15 Pro",
  "pushToken": "apns-or-fcm-token" // optional
}

// Response (200 OK)
{
  "deviceCredential": "encrypted-device-token",
  "expiresAt": "2025-03-13T00:00:00Z"
}

// Errors
// 400 - Invalid request body
// 409 - Device already registered (can be updated)
```

**Implementation notes:**
- Generate a secure, encrypted device credential
- Store in `MobileDevice` table
- Credential expires in 90 days
- Allow re-registration to update pushToken

---

### 2. Account Registration (Mobile)

**POST /api/mobile/auth/register**

Create a new wallet account from mobile.

```typescript
// Request
{
  "email": "user@example.com",
  "name": "John Doe",
  "deviceId": "uuid" // Must be registered first
}

// Response (201 Created)
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "walletId": "wsim_xxx"
  },
  "tokens": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 3600
  }
}

// Errors
// 400 - Invalid request / Device not registered
// 409 - Email already exists
```

**Implementation notes:**
- Reuse existing `WalletUser` creation logic
- Issue JWT tokens instead of session cookies
- Link device to user account

---

### 3. Biometric Setup

**POST /api/mobile/auth/biometric/setup**

Enable biometric authentication for a device.

```typescript
// Request (requires Authorization header)
{
  "deviceId": "uuid",
  "publicKey": "base64-encoded-public-key",
  "biometricType": "face" | "fingerprint"
}

// Response (200 OK)
{
  "biometricId": "uuid",
  "status": "enabled"
}

// Errors
// 400 - Invalid request
// 401 - Unauthorized
// 404 - Device not found
```

**Implementation notes:**
- Store public key in `MobileDevice.biometricPublicKey`
- Public key generated in device Secure Enclave
- Set `biometricEnabled = true`

---

### 4. Biometric Challenge

**POST /api/mobile/auth/biometric/challenge**

Request a challenge for biometric authentication.

```typescript
// Request
{
  "deviceId": "uuid"
}

// Response (200 OK)
{
  "challenge": "random-32-byte-base64-string",
  "expiresAt": "2024-12-13T12:05:00Z" // 5 minute expiry
}

// Errors
// 400 - Device not found or biometric not enabled
```

**Implementation notes:**
- Generate cryptographically random challenge
- Store challenge temporarily (Redis or DB) with 5-minute TTL
- One challenge per device at a time

---

### 5. Biometric Verify

**POST /api/mobile/auth/biometric/verify**

Verify biometric authentication and issue tokens.

```typescript
// Request
{
  "deviceId": "uuid",
  "biometricId": "uuid",
  "signature": "base64-signed-challenge",
  "challenge": "the-challenge-that-was-signed"
}

// Response (200 OK)
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}

// Errors
// 400 - Invalid request
// 401 - Invalid signature / Challenge expired
// 404 - Device or biometric not found
```

**Implementation notes:**
- Verify signature using stored public key
- Invalidate challenge after use
- Issue new token pair
- Update `MobileDevice.lastUsedAt`

---

### 6. Token Refresh

**POST /api/mobile/auth/token/refresh**

Refresh an expired access token.

```typescript
// Request
{
  "refreshToken": "jwt-refresh-token"
}

// Response (200 OK)
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token", // Rotate refresh tokens
  "expiresIn": 3600
}

// Errors
// 400 - Invalid request
// 401 - Invalid or expired refresh token
```

**Implementation notes:**
- Validate refresh token from `MobileRefreshToken` table
- Rotate refresh tokens (issue new, invalidate old)
- Access token lifetime: 1 hour
- Refresh token lifetime: 30 days

---

### 7. Logout

**POST /api/mobile/auth/logout**

Logout and invalidate tokens.

```typescript
// Request (requires Authorization header)
// No body required

// Response (200 OK)
{
  "success": true
}
```

**Implementation notes:**
- Revoke all refresh tokens for this device
- Optionally revoke all tokens for user (if `revokeAll=true` param)

---

### 8. Wallet Summary (Mobile-Optimized)

**GET /api/mobile/wallet/summary**

Get wallet overview in a single request.

```typescript
// Response (200 OK)
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "cards": [
    {
      "id": "uuid",
      "lastFour": "4242",
      "cardType": "VISA",
      "bankName": "TD Bank Simulator",
      "bankLogo": "https://...", // Optional
      "isDefault": true,
      "addedAt": "2024-01-15T00:00:00Z"
    }
  ],
  "enrolledBanks": [
    {
      "bsimId": "td-bsim",
      "name": "TD Bank Simulator",
      "cardCount": 2
    }
  ],
  "biometricEnabled": true
}

// Errors
// 401 - Unauthorized
```

**Implementation notes:**
- Combines user info, cards, and bank enrollments
- Reduces number of API calls on mobile
- Reuses existing `getCards()` and enrollment logic

---

## Existing Endpoint Modifications

### GET /api/enrollment/start/:bsimId

**Add query parameter support:**

```
GET /api/enrollment/start/:bsimId?mobile=true
```

When `mobile=true`:
- Set different callback URL for mobile deep linking
- Return success/failure via URL parameters for WebView detection
- Example success: `mwsim://enrollment/callback?success=true&bsimId=td`
- Example error: `mwsim://enrollment/callback?error=user_cancelled`

**Alternative:** Keep existing flow, mobile WebView detects success by URL pattern.

---

## JWT Token Structure

### Access Token Claims

```json
{
  "sub": "user-uuid",
  "iss": "https://wsim-dev.banksim.ca",
  "aud": "mwsim",
  "iat": 1702468800,
  "exp": 1702472400,
  "deviceId": "device-uuid",
  "type": "access"
}
```

### Refresh Token Claims

```json
{
  "sub": "user-uuid",
  "jti": "unique-token-id",
  "iat": 1702468800,
  "exp": 1705060800,
  "deviceId": "device-uuid",
  "type": "refresh"
}
```

---

## Security Considerations

1. **Device Binding**
   - Tokens are bound to device ID
   - Cannot use refresh token from different device

2. **Biometric Key Security**
   - Public key only stored on server
   - Private key never leaves device Secure Enclave
   - Challenge-response prevents replay attacks

3. **Token Rotation**
   - Refresh tokens are single-use
   - Detecting reuse indicates token theft → revoke all

4. **Rate Limiting**
   - Limit biometric challenge requests (e.g., 10/minute)
   - Limit failed verification attempts (e.g., 5 before lockout)

5. **CORS**
   - Mobile apps don't use CORS, but ensure API allows requests without Origin header
   - Or add mobile app identifier to allowed origins

---

## Implementation Priority

### Phase 1 (Required for MVP)
1. Device registration endpoint
2. Account registration endpoint
3. Token refresh endpoint
4. Wallet summary endpoint
5. Database schema changes

### Phase 2 (Biometric)
6. Biometric setup endpoint
7. Biometric challenge endpoint
8. Biometric verify endpoint

### Phase 3 (Enhancements)
9. Push notification token storage
10. Multi-device management
11. Enrollment URL parameter handling

---

## Questions for wsim Team

1. **JWT Secret**: Should we use the existing `JWT_SECRET` or create a separate one for mobile tokens?

2. **Token Lifetimes**: Are 1 hour (access) and 30 days (refresh) appropriate?

3. **Biometric Key Format**: What format should we use for the public key? (Suggestion: SPKI base64)

4. ~~**Existing Auth**: Should mobile users be able to sign in with existing wsim web accounts?~~ *Addressed in v1.1*

5. **Rate Limiting**: What rate limiting infrastructure exists that we can leverage?

---

## wsim Team Feedback & Responses (v1.1)

### 1. Existing Account Integration

**Question**: The proposal only covers registration. What about existing wsim users?

**Response**: Agreed. Adding login endpoint for existing accounts:

#### POST /api/mobile/auth/login

Sign in with existing wsim account and link mobile device.

```typescript
// Request
{
  "email": "user@example.com",
  "deviceId": "uuid" // Must be registered first
}

// Response (200 OK)
{
  "challenge": "email-verification-challenge",
  "method": "email" // or "passkey" if user has passkeys
}
```

Then verify with:

#### POST /api/mobile/auth/login/verify

```typescript
// For email verification (magic link or code)
{
  "email": "user@example.com",
  "deviceId": "uuid",
  "code": "123456" // From email
}

// Response (200 OK)
{
  "user": { "id": "...", "email": "...", "name": "..." },
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "expiresIn": 3600
  }
}
```

**Passkey Support**: For users with existing passkeys, mobile can support WebAuthn via:
- iOS: ASAuthorizationController (native passkey support)
- Android: FIDO2 API or Credential Manager

However, for Phase 1, we recommend **email verification** for existing account linking, with passkey support as a Phase 2 enhancement. Biometric (Face ID/Touch ID) on mobile provides equivalent security for day-to-day use once the device is linked.

---

### 2. Schema Sync

**Question**: New models need to go in both `backend/prisma/schema.prisma` and `auth-server/prisma/schema.prisma`.

**Response**: Acknowledged. We will:
1. Add models to both schema files
2. Run the sync validation script before PR
3. Ensure migrations are coordinated

---

### 3. Payment Endpoints

**Question**: How will mobile handle payments? Will mobile reuse Quick Pay endpoints or need mobile-specific ones?

**Response**: Mobile will **reuse existing merchant endpoints** with JWT auth:

```
POST /api/merchant/payment/initiate
POST /api/merchant/payment/confirm
```

**Changes needed**:
1. Accept `Authorization: Bearer <jwt>` header (in addition to existing session auth)
2. Validate JWT and extract userId the same way session does

Mobile flow:
1. User selects card in app
2. App calls `/api/merchant/payment/initiate` with JWT + card selection
3. Backend returns challenge
4. User completes biometric auth on device (Face ID / Touch ID)
5. App calls `/api/merchant/payment/confirm` with biometric confirmation
6. Backend returns card tokens for payment

**Note**: The biometric verification on mobile replaces the passkey verification in the web flow. Both provide user presence confirmation.

---

### 4. biometricId Redundancy

**Question**: In the verify request, `biometricId` seems redundant since biometric is tied to `deviceId`.

**Response**: Agreed. Removing `biometricId` from the verify request. Updated endpoint:

#### POST /api/mobile/auth/biometric/verify (Updated)

```typescript
// Request (simplified)
{
  "deviceId": "uuid",
  "signature": "base64-signed-challenge",
  "challenge": "the-challenge-that-was-signed"
}

// Response unchanged
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 3600,
  "user": { ... }
}
```

The server will look up the biometric public key from `MobileDevice` using `deviceId`.

---

## Updated Implementation Priority

### Phase 1 (Required for MVP)
1. Device registration endpoint
2. Account registration endpoint (new users)
3. **Account login endpoint (existing users)** ← Added
4. Token refresh endpoint
5. Wallet summary endpoint
6. Database schema changes (both schema files)

### Phase 2 (Biometric & Payments)
7. Biometric setup endpoint
8. Biometric challenge endpoint
9. Biometric verify endpoint (simplified)
10. **JWT support for merchant payment endpoints** ← Added

### Phase 3 (Enhancements)
11. Push notification token storage
12. Multi-device management
13. Passkey support for existing account linking
14. Enrollment URL parameter handling

---

## Next Steps

1. Review this proposal and provide feedback
2. Agree on implementation timeline
3. Create feature branch for mobile endpoints
4. Implement Phase 1 endpoints
5. Integration testing with mwsim app

---

*Document Version: 1.1*
*Updated: 2024-12-13*
*Contact: mwsim team*
