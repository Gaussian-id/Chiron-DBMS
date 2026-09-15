//! Runtime session-credential store.
//!
//! It temporarily retains the primary password for a `save_password=false`
//! connection in this process. Manual operations, editor SQL, AI tools,
//! metadata requests, and pool reconstruction can reuse the first password
//! without prompting again.
//!
//! This is separate from the persistent secret store
//! ([`crate::connection_secrets::FileSecretStore`]): persistent storage holds
//! saved passwords (`save_password=true`), while this store keeps only
//! transient runtime passwords (`save_password=false`) and never writes them
//! to disk.
//!
//! Invariants:
//! - Credentials exist only in Rust process memory and disappear on exit.
//! - They are never written to SQLite, cloud-sync exports, logs, or disk.
//! - [`fmt::Debug`] exposes only the credential count, never an owner,
//!   connection ID, or password value.
//!
//! # Web multi-session isolation
//!
//! Credentials use the compound `(owner_scope, connection_id)` key. Desktop
//! (Tauri) uses an empty owner; web uses the authenticated session token. This
//! prevents signed-in sessions from sharing transient passwords, and sign-out
//! clears only that session's credentials ([`SessionCredentialStore::clear_owner`]).
//!
//! The request boundary injects the owner through [`tokio::task_local`] (see
//! [`with_credential_owner`] and [`current_credential_owner`]), so deep
//! gauss-horizon-core pool creation does not need to thread it through every function
//! signature. Calls with no injected owner (desktop and background jobs) use
//! the empty owner and remain isolated from web sessions. If a background job
//! loses its owner, key mismatch fails closed: it cannot read any session
//! password and cannot leak credentials across sessions.

use std::collections::HashMap;
use std::fmt;
use std::future::Future;
use std::sync::RwLock;

/// Owner scope used by the single-user desktop (Tauri) runtime.
pub const DESKTOP_OWNER: &str = "";

#[derive(Clone, Eq, Hash, PartialEq)]
struct CredentialKey {
    owner_scope: String,
    connection_id: String,
}

impl CredentialKey {
    fn new(owner_scope: &str, connection_id: &str) -> Self {
        Self { owner_scope: owner_scope.to_string(), connection_id: connection_id.to_string() }
    }
}

#[derive(Clone, Eq, Hash, PartialEq)]
struct PurposeCredentialKey {
    credential: CredentialKey,
    purpose: String,
}

impl PurposeCredentialKey {
    fn new(owner_scope: &str, connection_id: &str, purpose: &str) -> Self {
        Self { credential: CredentialKey::new(owner_scope, connection_id), purpose: purpose.to_string() }
    }
}

struct SessionCredential {
    password: String,
    generation: u64,
}

#[derive(Default)]
struct SessionCredentialState {
    credentials: HashMap<CredentialKey, SessionCredential>,
    purpose_credentials: HashMap<PurposeCredentialKey, SessionCredential>,
    pool_credential_owners: HashMap<String, String>,
    next_generation: u64,
}

pub struct SessionCredentialWriteToken {
    key: CredentialKey,
    generation: u64,
}

pub struct PurposeSessionCredentialWriteToken {
    key: PurposeCredentialKey,
    generation: u64,
}

/// Authenticated session scope for the current request: a web session token or
/// the empty desktop owner.
///
/// The web authentication middleware injects it at the request boundary with
/// [`with_credential_owner`]. Calls with no injected scope (desktop,
/// background jobs, or an uncovered middleware path) return `None`; callers
/// then use the empty owner.
pub fn current_credential_owner() -> Option<String> {
    CREDENTIAL_OWNER.try_get().ok().flatten()
}

/// Sets the credential owner scope for an entire future.
///
/// Web authentication middleware wraps downstream handlers so their request
/// task, including awaited pool creation, can read the current session owner.
/// Calls not wrapped by this function (desktop and standalone background jobs)
/// are equivalent to using the empty owner.
pub async fn with_credential_owner<F, T>(owner_scope: Option<String>, future: F) -> T
where
    F: Future<Output = T>,
{
    CREDENTIAL_OWNER.scope(owner_scope, future).await
}

tokio::task_local! {
    static CREDENTIAL_OWNER: Option<String>;
}

/// In-memory session-credential store: `(owner_scope, connection_id) -> password`.
#[derive(Default)]
pub struct SessionCredentialStore {
    state: RwLock<SessionCredentialState>,
}

impl SessionCredentialStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Records the password entered for a no-save connection in this process.
    ///
    /// An empty password is a no-op: it neither overwrites nor deletes an
    /// existing credential. Only [`Self::remove`] explicitly removes it. Thus,
    /// building a pool with an empty configuration after a successful
    /// connection cannot accidentally erase the recorded password.
    pub fn set(&self, owner_scope: &str, connection_id: &str, password: &str) -> Option<SessionCredentialWriteToken> {
        if password.is_empty() {
            return None;
        }
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.next_generation = state.next_generation.checked_add(1).expect("session credential generation overflow");
        let key = CredentialKey::new(owner_scope, connection_id);
        let generation = state.next_generation;
        state.credentials.insert(key.clone(), SessionCredential { password: password.to_string(), generation });
        Some(SessionCredentialWriteToken { key, generation })
    }

    /// Returns an owner's transient runtime password, or `None` when absent.
    pub fn get(&self, owner_scope: &str, connection_id: &str) -> Option<String> {
        let state = self.state.read().unwrap_or_else(|error| error.into_inner());
        state.credentials.get(&CredentialKey::new(owner_scope, connection_id)).map(|entry| entry.password.clone())
    }

    /// Stores an additional transient secret for a connection-specific purpose.
    pub fn set_for_purpose(&self, owner_scope: &str, connection_id: &str, purpose: &str, password: &str) {
        let _ = self.set_for_purpose_with_token(owner_scope, connection_id, purpose, password);
    }

    /// Stores a purpose-specific secret and returns a token that can roll back
    /// this exact write without deleting a newer concurrent value.
    pub fn set_for_purpose_with_token(
        &self,
        owner_scope: &str,
        connection_id: &str,
        purpose: &str,
        password: &str,
    ) -> Option<PurposeSessionCredentialWriteToken> {
        if purpose.is_empty() || password.is_empty() {
            return None;
        }
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.next_generation = state.next_generation.checked_add(1).expect("session credential generation overflow");
        let key = PurposeCredentialKey::new(owner_scope, connection_id, purpose);
        let generation = state.next_generation;
        state.purpose_credentials.insert(key.clone(), SessionCredential { password: password.to_string(), generation });
        Some(PurposeSessionCredentialWriteToken { key, generation })
    }

    pub fn get_for_purpose(&self, owner_scope: &str, connection_id: &str, purpose: &str) -> Option<String> {
        let state = self.state.read().unwrap_or_else(|error| error.into_inner());
        state
            .purpose_credentials
            .get(&PurposeCredentialKey::new(owner_scope, connection_id, purpose))
            .map(|entry| entry.password.clone())
    }

    /// Returns whether an owner has a transient runtime password.
    pub fn has(&self, owner_scope: &str, connection_id: &str) -> bool {
        self.get(owner_scope, connection_id).is_some()
    }

    /// Clears an owner's transient password after deletion or an explicit forget.
    pub fn remove(&self, owner_scope: &str, connection_id: &str) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.credentials.remove(&CredentialKey::new(owner_scope, connection_id));
        state.purpose_credentials.retain(|key, _| {
            key.credential.owner_scope != owner_scope || key.credential.connection_id != connection_id
        });
    }

    /// Removes a credential only if this write is still current. Used to roll
    /// back a failed connection attempt without deleting a newer password.
    pub fn remove_if_current(&self, token: &SessionCredentialWriteToken) -> bool {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        let is_current =
            state.credentials.get(&token.key).is_some_and(|credential| credential.generation == token.generation);
        if is_current {
            state.credentials.remove(&token.key);
        }
        is_current
    }

    pub fn remove_purpose_if_current(&self, token: &PurposeSessionCredentialWriteToken) -> bool {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        let is_current = state
            .purpose_credentials
            .get(&token.key)
            .is_some_and(|credential| credential.generation == token.generation);
        if is_current {
            state.purpose_credentials.remove(&token.key);
        }
        is_current
    }

    /// Clears all credentials for one owner after web sign-out or session
    /// invalidation without affecting any other signed-in session.
    pub fn clear_owner(&self, owner_scope: &str) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.credentials.retain(|key, _| key.owner_scope != owner_scope);
        state.purpose_credentials.retain(|key, _| key.credential.owner_scope != owner_scope);
    }

    /// When global connection configuration is edited, deleted, or an ID is
    /// reused, atomically clears every owner's transient credentials and the
    /// connection's pool-owner markers. This prevents old passwords or pools
    /// from leaking into a new connection definition.
    pub fn clear_connection(&self, connection_id: &str) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.credentials.retain(|key, _| key.connection_id != connection_id);
        state.purpose_credentials.retain(|key, _| key.credential.connection_id != connection_id);
        let pool_prefix = format!("{connection_id}:");
        state
            .pool_credential_owners
            .retain(|pool_key, _| pool_key != connection_id && !pool_key.starts_with(&pool_prefix));
    }

    /// Clears all session credentials as a desktop-exit safeguard or full web
    /// instance reset.
    pub fn clear(&self) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.credentials.clear();
        state.purpose_credentials.clear();
    }

    pub fn record_pool_owner(&self, pool_key: &str, owner_scope: &str) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.pool_credential_owners.insert(pool_key.to_string(), owner_scope.to_string());
    }

    pub fn pool_owner_mismatch(&self, pool_key: &str, owner_scope: &str) -> bool {
        let state = self.state.read().unwrap_or_else(|error| error.into_inner());
        state.pool_credential_owners.get(pool_key).is_none_or(|recorded| recorded != owner_scope)
    }

    pub fn has_pool_owner(&self, pool_key: &str) -> bool {
        let state = self.state.read().unwrap_or_else(|error| error.into_inner());
        state.pool_credential_owners.contains_key(pool_key)
    }

    pub fn remove_pool_owners(&self, pool_keys: &[String]) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        for pool_key in pool_keys {
            state.pool_credential_owners.remove(pool_key);
        }
    }

    pub fn clear_pool_owners(&self) {
        let mut state = self.state.write().unwrap_or_else(|error| error.into_inner());
        state.pool_credential_owners.clear();
    }

    fn credential_count(&self) -> usize {
        let state = self.state.read().unwrap_or_else(|error| error.into_inner());
        state.credentials.len() + state.purpose_credentials.len()
    }
}

impl fmt::Debug for SessionCredentialStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SessionCredentialStore").field("credential_count", &self.credential_count()).finish()
    }
}

#[cfg(test)]
mod tests {
    use super::SessionCredentialStore;
    use std::sync::{Arc, Barrier};

    #[test]
    fn set_get_has_round_trip() {
        let store = SessionCredentialStore::new();
        assert!(!store.has("", "conn-a"));
        assert_eq!(store.get("", "conn-a"), None);

        let _ = store.set("", "conn-a", "s3cret");
        assert!(store.has("", "conn-a"));
        assert_eq!(store.get("", "conn-a").as_deref(), Some("s3cret"));
    }

    #[test]
    fn set_with_empty_password_is_noop_and_keeps_existing() {
        let store = SessionCredentialStore::new();
        let _ = store.set("", "conn-a", "s3cret");
        let empty_write = store.set("", "conn-a", "");
        assert!(empty_write.is_none());
        assert_eq!(store.get("", "conn-a").as_deref(), Some("s3cret"));
    }

    #[test]
    fn remove_clears_credential() {
        let store = SessionCredentialStore::new();
        let _ = store.set("", "conn-a", "s3cret");
        store.remove("", "conn-a");
        assert!(!store.has("", "conn-a"));
        assert_eq!(store.get("", "conn-a"), None);
    }

    #[test]
    fn clear_removes_all_credentials() {
        let store = SessionCredentialStore::new();
        let _ = store.set("", "conn-a", "secret-a");
        let _ = store.set("", "conn-b", "secret-b");
        store.clear();
        assert!(!store.has("", "conn-a"));
        assert!(!store.has("", "conn-b"));
        assert_eq!(store.get("", "conn-a"), None);
    }

    #[test]
    fn credentials_are_isolated_by_connection_id() {
        let store = SessionCredentialStore::new();
        let _ = store.set("", "conn-a", "secret-a");
        let _ = store.set("", "conn-b", "secret-b");
        assert_eq!(store.get("", "conn-a").as_deref(), Some("secret-a"));
        assert_eq!(store.get("", "conn-b").as_deref(), Some("secret-b"));
        store.remove("", "conn-a");
        assert_eq!(store.get("", "conn-a"), None);
        assert_eq!(store.get("", "conn-b").as_deref(), Some("secret-b"));
    }

    #[test]
    fn credentials_are_isolated_by_owner_scope() {
        let store = SessionCredentialStore::new();
        let _ = store.set("token-x", "conn-a", "x-secret");
        let _ = store.set("token-y", "conn-a", "y-secret");
        // The same connection is invisible across signed-in sessions.
        assert_eq!(store.get("token-x", "conn-a").as_deref(), Some("x-secret"));
        assert_eq!(store.get("token-y", "conn-a").as_deref(), Some("y-secret"));
        // The desktop's empty owner is isolated from every session token.
        assert!(!store.has("", "conn-a"));
        assert!(!store.has("token-z", "conn-a"));
    }

    #[test]
    fn clear_owner_only_removes_that_sessions_credentials() {
        let store = SessionCredentialStore::new();
        let _ = store.set("token-x", "conn-a", "x-secret");
        let _ = store.set("token-y", "conn-a", "y-secret");
        let _ = store.set("token-y", "conn-b", "y2-secret");
        store.clear_owner("token-y");
        // Signing out Y clears only Y's credentials, not X's or the desktop's.
        assert!(!store.has("token-y", "conn-a"));
        assert!(!store.has("token-y", "conn-b"));
        assert!(store.has("token-x", "conn-a"));
    }

    #[test]
    fn purpose_credentials_follow_owner_and_connection_cleanup() {
        let store = SessionCredentialStore::new();
        store.set_for_purpose("token-x", "conn-a", "nacos-primary", "new-secret");
        store.set_for_purpose("token-y", "conn-a", "nacos-primary", "other-secret");

        assert_eq!(store.get_for_purpose("token-x", "conn-a", "nacos-primary").as_deref(), Some("new-secret"));
        assert_eq!(store.get_for_purpose("token-y", "conn-a", "nacos-primary").as_deref(), Some("other-secret"));
        store.clear_owner("token-x");
        assert_eq!(store.get_for_purpose("token-x", "conn-a", "nacos-primary"), None);
        store.clear_connection("conn-a");
        assert_eq!(store.get_for_purpose("token-y", "conn-a", "nacos-primary"), None);
    }

    #[test]
    fn stale_purpose_write_token_cannot_remove_newer_credential() {
        let store = SessionCredentialStore::new();
        let first = store.set_for_purpose_with_token("token-x", "conn-a", "nacos-console", "first-secret").unwrap();
        let second = store.set_for_purpose_with_token("token-x", "conn-a", "nacos-console", "second-secret").unwrap();

        assert!(!store.remove_purpose_if_current(&first));
        assert_eq!(store.get_for_purpose("token-x", "conn-a", "nacos-console").as_deref(), Some("second-secret"));
        assert!(store.remove_purpose_if_current(&second));
        assert_eq!(store.get_for_purpose("token-x", "conn-a", "nacos-console"), None);
    }

    #[test]
    fn debug_output_hides_password_values() {
        let store = SessionCredentialStore::new();
        let _ = store.set("session-token-sensitive", "connection-sensitive", "super-secret-value");
        let debug = format!("{store:?}");
        assert!(debug.contains("credential_count: 1"));
        assert!(!debug.contains("session-token-sensitive"));
        assert!(!debug.contains("connection-sensitive"));
        assert!(!debug.contains("super-secret-value"));
    }

    #[test]
    fn clear_connection_removes_all_owners_and_pool_owner_state() {
        let store = SessionCredentialStore::new();
        let _ = store.set("token-x", "conn-a", "x-secret");
        let _ = store.set("token-y", "conn-a", "y-secret");
        let _ = store.set("token-y", "conn-b", "other-secret");
        store.record_pool_owner("conn-a", "token-x");
        store.record_pool_owner("conn-a:analytics", "token-y");
        store.record_pool_owner("conn-b", "token-y");

        store.clear_connection("conn-a");

        assert!(!store.has("token-x", "conn-a"));
        assert!(!store.has("token-y", "conn-a"));
        assert!(store.has("token-y", "conn-b"));
        assert!(!store.has_pool_owner("conn-a"));
        assert!(!store.has_pool_owner("conn-a:analytics"));
        assert!(store.pool_owner_mismatch("conn-a", "token-z"));
        assert!(store.pool_owner_mismatch("conn-a:analytics", "token-z"));
        assert!(store.has_pool_owner("conn-b"));
        assert!(store.pool_owner_mismatch("conn-b", "token-z"));
    }

    #[test]
    fn stale_write_token_cannot_remove_newer_credential() {
        let store = Arc::new(SessionCredentialStore::new());
        let first_write_done = Arc::new(Barrier::new(2));
        let second_write_done = Arc::new(Barrier::new(2));
        let attempt_store = store.clone();
        let attempt_first_write_done = first_write_done.clone();
        let attempt_second_write_done = second_write_done.clone();

        let attempt_a = std::thread::spawn(move || {
            let token = attempt_store.set("token-x", "conn-a", "attempt-a-password").unwrap();
            attempt_first_write_done.wait();
            attempt_second_write_done.wait();
            assert!(!attempt_store.remove_if_current(&token));
        });

        first_write_done.wait();
        let _attempt_b_token = store.set("token-x", "conn-a", "attempt-b-password").unwrap();
        second_write_done.wait();
        attempt_a.join().unwrap();

        assert_eq!(store.get("token-x", "conn-a").as_deref(), Some("attempt-b-password"));
    }
}
