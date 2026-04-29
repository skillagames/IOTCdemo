# Security Specification: IoT Connect App

## Data Invariants
1. **User Identity**: A user document must match the authenticated `request.auth.uid`. Role must be 'user' by default.
2. **Device Ownership**: Every device must have an `ownerId` matching the creator's UID.
3. **Relational Integrity**: Usage stats can only be created for devices that exist and are owned by the user.
4. **Hardware Verification**: `master_registry` acts as a read-only (for users) verification source for hardware serial numbers.

## The Dirty Dozen (Vulnerability Test Payloads)
1. **Identity Spoofing**: Attempt to create a user profile for a different UID.
2. **Privilege Escalation**: Attempt to create/update user profile with `role: 'admin'`.
3. **Shadow Field Injection**: Attempt to create device with undocumented field `is_free: true`.
4. **Ownership Takeover**: Attempt to update a device's `ownerId` to the current user's UID.
5. **Unauthorized Device Access**: Attempt to read/write a device owned by another user.
6. **Cross-Subcollection Leak**: Attempt to read usage stats for a device owned by someone else.
7. **Orphaned Stats**: Attempt to create usage stats for a non-existent device ID.
8. **ID Poisoning**: Attempt to use 1MB string as a device ID.
9. **Terminal State Bypass**: Attempt to update a device name after it has been marked `deactivated` (if terminal status exists).
10. **Timestamp Fraud**: Attempt to set `lastUpdated` to a date in the future.
11. **PII Leak**: Attempt to list all users' emails/profiles as a non-admin.
12. **Master Registry Poisoning**: Attempt to modify `master_registry` as a non-admin.

## Test Runner
Testing will be performed via `firestore.rules.test.ts` (conceptual / simulated in logic).
