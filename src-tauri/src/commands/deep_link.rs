use std::collections::HashSet;
use std::sync::Mutex;

const CONNECTION_DEEP_LINK_PREFIX: &str = "gauss-horizon://connection/new";
const AI_CONFIG_DEEP_LINK_PREFIX: &str = "gauss-horizon://settings/ai/new";
const APP_OPEN_DEEP_LINK_PREFIX: &str = "gauss-horizon://open";

#[tauri::command]
pub fn pending_open_connection_links(state: tauri::State<'_, DeepLinkOpenState>) -> Vec<String> {
    dedupe_links(state.drain_connection_links())
}

#[tauri::command]
pub fn pending_open_ai_config_links(state: tauri::State<'_, DeepLinkOpenState>) -> Vec<String> {
    dedupe_links(state.drain_ai_config_links())
}

#[derive(Default)]
pub struct DeepLinkOpenState {
    pending_connection_links: Mutex<Vec<String>>,
    pending_ai_config_links: Mutex<Vec<String>>,
}

impl DeepLinkOpenState {
    pub fn push_connection_links(&self, links: Vec<String>) {
        if links.is_empty() {
            return;
        }
        if let Ok(mut pending) = self.pending_connection_links.lock() {
            pending.extend(links);
        }
    }

    pub fn push_ai_config_links(&self, links: Vec<String>) {
        if links.is_empty() {
            return;
        }
        if let Ok(mut pending) = self.pending_ai_config_links.lock() {
            pending.extend(links);
        }
    }

    fn drain_connection_links(&self) -> Vec<String> {
        self.pending_connection_links.lock().map(|mut pending| pending.drain(..).collect()).unwrap_or_default()
    }

    fn drain_ai_config_links(&self) -> Vec<String> {
        self.pending_ai_config_links.lock().map(|mut pending| pending.drain(..).collect()).unwrap_or_default()
    }
}

pub fn connection_deep_links_from_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().filter_map(|arg| connection_deep_link_from_arg(arg.as_ref())).collect()
}

pub fn connection_deep_link_from_arg(arg: &str) -> Option<String> {
    let trimmed = arg.trim();
    matches_deep_link_target(trimmed, CONNECTION_DEEP_LINK_PREFIX).then(|| trimmed.to_string())
}

pub fn ai_config_deep_links_from_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().filter_map(|arg| ai_config_deep_link_from_arg(arg.as_ref())).collect()
}

pub fn ai_config_deep_link_from_arg(arg: &str) -> Option<String> {
    let trimmed = arg.trim();
    matches_deep_link_target(trimmed, AI_CONFIG_DEEP_LINK_PREFIX).then(|| trimmed.to_string())
}

pub fn is_app_open_deep_link(arg: &str) -> bool {
    matches_deep_link_target(arg.trim(), APP_OPEN_DEEP_LINK_PREFIX)
}

fn matches_deep_link_target(value: &str, target: &str) -> bool {
    let Some(suffix) = value.strip_prefix(target) else {
        return false;
    };
    suffix.is_empty()
        || suffix.starts_with('?')
        || suffix.starts_with('#')
        || suffix == "/"
        || suffix.starts_with("/?")
        || suffix.starts_with("/#")
}

fn dedupe_links(links: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for link in links {
        if seen.insert(link.clone()) {
            unique.push(link);
        }
    }
    unique
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_connection_deep_links() {
        let links = connection_deep_links_from_args([
            "gauss-horizon://connection/new?type=mysql&host=127.0.0.1",
            "gauss-horizon://settings/ai/new?provider=openai-compatible",
            "--flag",
            "gauss-horizon://open?x=1",
            "gauss-horizon://connections/new?type=postgres",
            "gauss-horizon://connection/newer?type=mysql",
        ]);

        assert_eq!(links, vec!["gauss-horizon://connection/new?type=mysql&host=127.0.0.1".to_string()]);
    }

    #[test]
    fn filters_ai_config_deep_links() {
        let links = ai_config_deep_links_from_args([
            "gauss-horizon://settings/ai/new?v=1&provider=openai-compatible",
            "--flag",
            "gauss-horizon://settings/ai/edit?provider=openai-compatible",
            "gauss-horizon://settings/ai/newer?provider=openai-compatible",
            "gauss-horizon://connection/new?type=mysql",
        ]);

        assert_eq!(links, vec!["gauss-horizon://settings/ai/new?v=1&provider=openai-compatible".to_string()]);
    }

    #[test]
    fn recognizes_app_open_deep_links() {
        assert!(is_app_open_deep_link("gauss-horizon://open"));
        assert!(is_app_open_deep_link(" gauss-horizon://open?source=sponsor "));
        assert!(is_app_open_deep_link("gauss-horizon://open/#landing"));
        assert!(!is_app_open_deep_link("gauss-horizon://opened"));
        assert!(!is_app_open_deep_link("gauss-horizon://open/window"));
        assert!(!is_app_open_deep_link("gauss-horizon://connection/new"));
    }

    #[test]
    fn drains_pending_links_once() {
        let state = DeepLinkOpenState::default();
        state.push_connection_links(vec!["gauss-horizon://connection/new?type=mysql".to_string()]);
        state.push_ai_config_links(vec!["gauss-horizon://settings/ai/new?provider=openai-compatible".to_string()]);

        assert_eq!(state.drain_connection_links(), vec!["gauss-horizon://connection/new?type=mysql"]);
        assert_eq!(state.drain_ai_config_links(), vec!["gauss-horizon://settings/ai/new?provider=openai-compatible"]);
        assert!(state.drain_connection_links().is_empty());
        assert!(state.drain_ai_config_links().is_empty());
    }

    #[test]
    fn dedupes_links_while_preserving_order() {
        assert_eq!(
            dedupe_links(vec![
                "gauss-horizon://connection/new?type=mysql".to_string(),
                "gauss-horizon://connection/new?type=postgres".to_string(),
                "gauss-horizon://connection/new?type=mysql".to_string(),
            ]),
            vec!["gauss-horizon://connection/new?type=mysql", "gauss-horizon://connection/new?type=postgres"]
        );
    }
}
