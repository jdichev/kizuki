#[cfg(feature = "napi-export")]
use napi::bindgen_prelude::*;
#[cfg(feature = "napi-export")]
use napi_derive::napi;

use reqwest::Client;
use scraper::{Html, Selector};
use url::Url;

#[cfg(feature = "napi-export")]
#[napi(object)]
pub struct LinkInfo {
    pub url: String,
    pub text: String,
}

#[cfg(not(feature = "napi-export"))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinkInfo {
    pub url: String,
    pub text: String,
}

pub async fn fetch_links_internal(url: String) -> std::result::Result<Vec<LinkInfo>, String> {
    let client = Client::builder()
        .user_agent("Forest/1.0 (Link Extractor)")
        .build()
        .unwrap_or_default();
    let base_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;

    match client.get(&url).send().await {
        Ok(response) => match response.text().await {
            Ok(html) => {
                let links = extract_links(&html, &base_url);
                Ok(links)
            }
            Err(e) => Err(format!("Failed to read response body: {}", e)),
        },
        Err(e) => Err(format!("Failed to fetch URL: {}", e)),
    }
}

#[cfg(feature = "napi-export")]
#[napi]
pub async fn fetch_links_async(url: String) -> Result<Vec<LinkInfo>> {
    fetch_links_internal(url)
        .await
        .map_err(Error::from_reason)
}

#[cfg(feature = "napi-export")]
#[napi]
pub async fn fetch_links(url: String) -> Result<Vec<LinkInfo>> {
    fetch_links_async(url).await
}

fn extract_links(html: &str, base_url: &Url) -> Vec<LinkInfo> {
    let document = Html::parse_document(html);
    let selector = Selector::parse("a[href]").unwrap();

    document
        .select(&selector)
        .filter_map(|element| {
            let href = element.value().attr("href")?;
            let url = Url::parse(href).ok().or_else(|| base_url.join(href).ok())?;
            let text = normalize_link_text(element.text().collect::<String>().as_str());
            Some(LinkInfo {
                url: url.to_string(),
                text,
            })
        })
        .collect()
}

fn normalize_link_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_links_simple() {
        let html = r#"<a href="https://example.com">Link</a>"#;
        let base_url = Url::parse("https://example.com").unwrap();
        let links = extract_links(html, &base_url);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].url, "https://example.com/");
        assert_eq!(links[0].text, "Link");
    }

    #[test]
    fn test_extract_links_multiple() {
        let html = r#"
                        <a href="/one">Link 1</a>
                        <a href="https://google.com">Link 2</a>
        "#;
        let base_url = Url::parse("https://example.com").unwrap();
        let links = extract_links(html, &base_url);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].url, "https://example.com/one");
        assert_eq!(links[0].text, "Link 1");
        assert_eq!(links[1].url, "https://google.com/");
        assert_eq!(links[1].text, "Link 2");
    }
}
