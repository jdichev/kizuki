import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Article from "./Article";

const textArticle = {
  id: 78173,
  url: "https://elevenews.com/2021/03/21/why-ethereum-must-hold-1700-for-fresh-rally-to-2000-2/",
  title: "Why Ethereum Must Hold $1,700 for Fresh Rally To $2,000",
  content:
    '<p><em>Ethereum struggled to settle above the $1,850 resistance and corrected lower against the US Dollar. ETH price is must stay above $1,700 to avoid a strong downside break.</em></p>\n<ul>\n<li>ETH price is moving lower from the $1,850 resistance zone against the US Dollar.</li>\n<li>The price is approaching the $1,780 support and the 100 simple moving average (4-hours).</li>\n<li>There is a key rising channel forming with support near $1,775 on the 4-hours chart of ETH/USD (data feed via Kraken).</li>\n<li>The pair is likely to decline heavily if it fails to stay above $1,775 and then $1,700 in the near term.</li>\n</ul>\n<h2>Ethereum Is Facing Hurdles</h2>\n<p>This past week, bitcoin and ethereum saw a fresh decline from $60,000 and $1,880 respectively against the US Dollar. ETH remained well bid above the&nbsp;$1,710 level&nbsp;and the 100 simple moving average (4-hours).</p>\n<p>The last swing low was formed near $1,173 before there was an upward move. The price climbed above the $1,800 resistance level. There was a break above the 50% Fib retracement level of the downward move from the $1,942 high to $1,713 low.</p>\n<div></div>\n<p>However, the price failed to clear the $1,850 resistance zone. It seems like the price failed to clear the 61.8% Fib retracement level of the downward move from the $1,942 high to $1,713 low.</p>\n<p><a target="_blank" rel="noreferrer noopener" href="https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17.png" rel="noopener"><img src="https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17.png" srcset="https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17.png 1944w, https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17-460x272.png 460w, https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17-860x508.png 860w, https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17-768x454.png 768w, https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17-1536x908.png 1536w, https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17-750x443.png 750w, https://www.newsbtc.com/wp-content/uploads/2021/03/Ethereum-17-1140x674.png 1140w" alt="Ethereum"></a></p>\n<pre>Source: ETHUSD on TradingView.com</pre>\n<p>Ether is currently declining and trading below $1,800. There is also a key rising channel forming with support near $1,775 on the 4-hours chart of ETH/USD. If there is a downside break below the channel support, there is a risk of a drop towards the $1,710 support. Any more losses below $1,700 may possibly open the doors for a larger decline towards $1,550 and $1,500.</p>\n<div></div>\n<h2>Fresh Rally in Ether (ETH)?</h2>\n<p>If Ethereum stays above the channel support or $1,700, it could attempt a&nbsp;fresh increase. An initial resistance on the upside is near the $1,820 level.</p>\n<p>The first key resistance is near the $1,850 and $1,855 levels. If ether price breaks the $1,850 resistance, there are high chances of a strong increase in the coming sessions. The next key resistance sits near the $1,920 and $1,950 levels.</p>\n<p>Technical Indicators</p>\n<div></div>\n<p>4 hours MACD – The MACD for ETH/USD is now gaining momentum in the bearish zone.</p>\n<p>4 hours RSI – The RSI for ETH/USD is now just below the 50 level.</p>\n<p>Major Support Level – $1,710</p>\n<p>Major Resistance Level – $1,850</p>\n<p><a target="_blank" rel="noreferrer noopener" href="https://www.newsbtc.com/analysis/eth/ethereum-must-hold-1700/" rel="noopener">News Source</a></p>\n',
  feed_id: 1061,
  published: 1616342317000,
  comments: "https://elevenews.com/test-comments-link",
  read: 0,
  created: 1616342416254,
  json_content: {},
};

test("renders article", async () => {
  render(<Article article={textArticle} />);

  const renderedUpperLink = screen.getByTestId("upper-outbound-link");
  const renderedLowerLink = screen.getByTestId("lower-outbound-link");
  const renderedCommentsLink = screen.getByTestId("comments-link");

  expect(renderedUpperLink.getAttribute("href")).toEqual(textArticle.url);
  expect(renderedLowerLink.getAttribute("href")).toEqual(textArticle.url);
  expect(renderedCommentsLink.getAttribute("href")).toEqual(
    textArticle.comments
  );
  expect(
    document.querySelector("#content .blocked-external-image")
  ).toBeTruthy();
  expect(document.querySelector("#content img")).toBeNull();
});

test("loads external images when toggled for an article", async () => {
  render(<Article article={textArticle} />);

  const toggleButton = screen.getByRole("button", {
    name: "Load",
  });

  fireEvent.click(toggleButton);

  expect(document.querySelector("#content img")).toBeTruthy();
  expect(document.querySelector("#content .blocked-external-image")).toBeNull();
});

test("clicking blocked image link enables external images", async () => {
  render(<Article article={textArticle} />);

  const blockedImagePlaceholder = screen.getByRole("img", {
    name: "External image",
  });

  fireEvent.click(blockedImagePlaceholder);

  await waitFor(() => {
    expect(document.querySelector("#content img")).toBeTruthy();
    expect(document.querySelector("#content .blocked-external-image")).toBeNull();
  });
});

test("renders article placeholder", async () => {
  render(<Article article={undefined} />);

  const renderedArticlePlaceholder = screen.getByTestId("article-placeholder");

  expect(renderedArticlePlaceholder.textContent).toContain("Happy");
});

const ytVideoArticle = {
  id: 77987,
  url: "https://www.youtube.com/watch?v=oCGAk-keIv4",
  title: "WOT - Kunze Panzer Review - If You Don't Pay You Can't Have One!",
  content: "",
  feed_id: 1068,
  published: 1616328013000,
  comments: undefined,
  read: 1,
  created: 1616328618312,
  jsonContent: { "yt-id": "oCGAk-keIv4" },
};

test("renders video article", async () => {
  render(<Article article={ytVideoArticle} />);

  const renderedFrame = screen.getByTestId("yt-embed-frame");

  expect(
    renderedFrame
      .getAttribute("src")
      ?.includes(ytVideoArticle.jsonContent["yt-id"])
  ).toBeTruthy();
  expect(screen.queryByText("External images blocked for privacy")).toBeNull();
});
