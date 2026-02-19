use fetch_links::fetch_links_internal;
use httpmock::prelude::*;

#[tokio::test]
async fn test_fetch_links_from_url() {
  let html = r#"
    <html>
      <body>
        <a href="/relative">Relative Link</a>
        <a href="https://example.org/absolute">Absolute Link</a>
      </body>
    </html>
    "#;

  let server = MockServer::start();
  server.mock(|when, then| {
    when.method(GET).path("/test");
    then.status(200).header("content-type", "text/html").body(html);
  });

  let url = format!("http://127.0.0.1:{}/test", server.port());
  let links = fetch_links_internal(url)
    .await
    .expect("fetch_links_internal should succeed");

  assert_eq!(links.len(), 2);
  assert_eq!(links[0].url, format!("http://127.0.0.1:{}/relative", server.port()));
  assert_eq!(links[0].text, "Relative Link");
  assert_eq!(links[1].url, "https://example.org/absolute");
  assert_eq!(links[1].text, "Absolute Link");
}
