pub const R2_CDN_BASE: &str = "https://distribution-disabled.invalid/";
pub const GITHUB_RELEASE_DOWNLOAD_PREFIX: &str = "https://github.com/Gaussian-id/Chiron-DBMS/releases/download/";
pub const CNB_RELEASE_DOWNLOAD_PREFIX: &str = "https://distribution-disabled.invalid/-/releases/download/";

#[derive(Clone, Copy, Debug, Default, serde::Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum DownloadSource {
    #[default]
    Official,
    Cnb,
}

impl DownloadSource {
    pub fn download_candidate_urls(self, github_url: &str, r2_path: &str) -> Result<Vec<String>, String> {
        crate::distribution::ensure_enabled()?;
        match self {
            Self::Official => Ok(download_candidate_urls(github_url, r2_path)),
            Self::Cnb => Ok(mirror_download_candidate_urls(
                r2_path,
                rewrite_github_release_url(github_url, CNB_RELEASE_DOWNLOAD_PREFIX)?,
            )),
        }
    }
}

fn mirror_download_candidate_urls(r2_path: &str, mirror_url: String) -> Vec<String> {
    let r2_url = format!("{R2_CDN_BASE}{r2_path}");
    vec![mirror_url, r2_url]
}

fn rewrite_github_release_url(url: &str, target_prefix: &str) -> Result<String, String> {
    if url.starts_with(target_prefix) {
        return Ok(url.to_string());
    }
    url.strip_prefix(GITHUB_RELEASE_DOWNLOAD_PREFIX)
        .map(|path| format!("{target_prefix}{path}"))
        .ok_or_else(|| format!("Unsupported Chiron Horizon release download URL: {url}"))
}

pub fn download_candidate_urls(github_url: &str, r2_path: &str) -> Vec<String> {
    let _ = (github_url, r2_path);
    Vec::new()
}

use std::pin::Pin;

type ResponseFuture = Pin<Box<dyn std::future::Future<Output = Result<reqwest::Response, String>> + Send>>;

pub async fn race_download(
    client: &reqwest::Client,
    github_url: &str,
    r2_path: &str,
    user_agent: &str,
) -> Result<reqwest::Response, String> {
    race_download_urls(client, &download_candidate_urls(github_url, r2_path), user_agent).await
}

pub async fn race_download_urls(
    client: &reqwest::Client,
    urls: &[String],
    user_agent: &str,
) -> Result<reqwest::Response, String> {
    use futures::future::select_ok;

    let mut futs: Vec<ResponseFuture> = Vec::with_capacity(urls.len());

    for url in urls {
        let client = client.clone();
        let url = url.clone();
        let ua = user_agent.to_string();
        futs.push(Box::pin(async move {
            client
                .get(url)
                .header(reqwest::header::USER_AGENT, ua)
                .header(reqwest::header::ACCEPT_ENCODING, "identity")
                .send()
                .await
                .and_then(|r| r.error_for_status())
                .map_err(|e| format!("{e}"))
        }) as ResponseFuture);
    }

    match select_ok(futs).await {
        Ok((resp, _)) => Ok(resp),
        Err(last_err) => Err(last_err),
    }
}

#[cfg(test)]
mod tests {
    use super::{download_candidate_urls, DownloadSource};
    #[test]
    fn unpublished_distribution_has_no_candidate_requests() {
        assert!(download_candidate_urls("https://example.com/package", "package").is_empty());
        for source in [DownloadSource::Official, DownloadSource::Cnb] {
            assert!(source
                .download_candidate_urls("https://example.com/package", "package")
                .unwrap_err()
                .contains("not available"));
        }
    }
}
