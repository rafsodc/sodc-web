# Enabled-claim reconciliation

Firebase Auth claims are a restrictive, versioned mirror of server-owned `UserSecurityState`; they cannot grant application access by themselves. See [Current authorization and issued-token revocation](./current-authorization.md) for the full contract, staged migration, operator commands and release gate.

The eligible membership statuses remain `REGULAR`, `RETIRED`, `RESERVE`, `INDUSTRY` and `CIVIL_SERVICE`. `PENDING`, `RESIGNED`, `LOST` and `DECEASED` remain restricted, including for retained administrators. Effective access additionally requires a non-disabled verified Auth identity, no verification hold, a matching current profile status and a READY security version.

Restrictions atomically commit profile status, denied readiness, incremented version and durable transition before Auth synchronization. Grants use the same denied-first transaction and become ready only after fresh Auth mirror verification. Failed or superseded work cannot make another version ready. Both restriction and restoration increment the version, so restoration never revives an old token. Unrelated Auth claims are preserved.

An authorised admin may resubmit the stored membership status to repair current intent; a pending intent resumes before any fresh transition. The reconciliation scheduler also retries pending transitions and repairs READY mirror drift. An operator can audit or resume the durable operation through `security-state-admin --mode repair`; this does not reimport roles from Auth or invent a grant. Recovery from a deliberate restriction requires an explicitly authorised new transition. Review pending/error ledger rows and rerun the UID-only audit.

Potential Lost confirmation commits its evidence CAS, review audit, profile restriction and security denial/version in the same transaction. Notify delivery receipts only update delivery/bounce evidence; they never change membership or authorization. Initial or changed-address verification recovery releases only an explicit exact-address hold from freshly verified Auth state.

After successful synchronization, refresh the user's token (or sign out/in) before testing access. The unchanged older signed token must continue to fail protected client connector and callable operations. No deployment, backfill or real-token gate is performed by the normal unit suite.
