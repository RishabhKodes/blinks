import ogs from "open-graph-scraper";
import { Defuddle } from "defuddle/node";

export interface FetchedContent {
  url: string;
  title: string;
  description: string;
  author: string;
  source: string;
  type: string;
  thumbnail: string;
  textContent: string;
}

interface SourceInfo {
  source: string;
  type: string;
}

function detectSource(url: string): SourceInfo {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
    return { source: "twitter", type: "tweet" };
  }
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return { source: "youtube", type: "video" };
  }
  if (hostname.includes("github.com")) {
    return { source: "github", type: "repo" };
  }
  if (hostname.includes("arxiv.org")) {
    return { source: "arxiv", type: "article" };
  }
  if (hostname.includes("medium.com")) {
    return { source: "medium", type: "article" };
  }
  if (hostname.includes("reddit.com")) {
    return { source: "reddit", type: "article" };
  }
  if (hostname.includes("substack.com") || hostname.includes("beehiiv.com")) {
    return { source: "newsletter", type: "article" };
  }
  if (hostname.includes("podcasts.apple.com") || hostname.includes("spotify.com")) {
    return { source: hostname.includes("spotify") ? "spotify" : "apple-podcasts", type: "podcast" };
  }
  if (hostname.includes("news.ycombinator.com")) {
    return { source: "hackernews", type: "article" };
  }
  if (hostname.includes("stackoverflow.com")) {
    return { source: "stackoverflow", type: "article" };
  }
  if (hostname.includes("wikipedia.org")) {
    return { source: "wikipedia", type: "article" };
  }

  // Strip "www." for a cleaner source name
  const cleanHost = hostname.replace(/^www\./, "");
  return { source: cleanHost, type: "article" };
}

// Extract tweet text via FxTwitter API (no auth needed)
async function fetchTweet(url: string): Promise<FetchedContent | null> {
  // Parse the tweet path: /username/status/1234567890
  const parsed = new URL(url);
  const pathMatch = parsed.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
  if (!pathMatch) return null;

  const [, username, tweetId] = pathMatch;
  const apiUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;

  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "blinks/1.0" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const tweet = data.tweet;
    if (!tweet) return null;

    const tweetText = tweet.text || "";
    const authorName = tweet.author?.name || username;
    const authorHandle = tweet.author?.screen_name || username;

    // Build a rich text content block for the LLM
    const textParts = [`Tweet by @${authorHandle} (${authorName}):\n${tweetText}`];

    // Include quote tweet text if present
    if (tweet.quote) {
      textParts.push(`\nQuoted tweet by @${tweet.quote.author?.screen_name || "unknown"}:\n${tweet.quote.text || ""}`);
    }

    const textContent = textParts.join("\n");

    // Use first few words of tweet as title if it's long, otherwise full text
    const titleText = tweetText.length > 80
      ? tweetText.slice(0, 77) + "..."
      : tweetText;

    return {
      url,
      title: titleText || `Tweet by @${authorHandle}`,
      description: tweetText,
      author: authorName,
      source: "twitter",
      type: "tweet",
      thumbnail: tweet.author?.avatar_url || tweet.media?.photos?.[0]?.url || "",
      textContent: truncateText(textContent, 4000),
    };
  } catch (error) {
    console.error("FxTwitter fetch failed:", error);
    return null;
  }
}

export async function fetchContent(url: string): Promise<FetchedContent> {
  const { source, type } = detectSource(url);

  // Special handling for Twitter/X
  if (type === "tweet") {
    const tweetData = await fetchTweet(url);
    if (tweetData) return tweetData;
    // Fall through to generic fetcher if tweet API fails
  }

  // Fetch HTML, OG metadata, and run Defuddle in parallel
  const [htmlResult, ogResult] = await Promise.allSettled([
    fetch(url, { redirect: "follow", headers: { "User-Agent": "blinks/1.0" } })
      .then(async (r) => (r.ok ? { text: await r.text(), finalUrl: r.url } : null)),
    ogs({ url }),
  ]);

  let ogTitle = "";
  let ogDescription = "";
  let ogImage = "";
  let ogSiteName = "";

  if (ogResult.status === "fulfilled") {
    const { result } = ogResult.value;
    ogTitle = result.ogTitle || "";
    ogDescription = result.ogDescription || "";
    ogSiteName = result.ogSiteName || "";
    if (result.ogImage && result.ogImage.length > 0) {
      ogImage = result.ogImage[0].url || "";
    }
  }

  let defuddleTitle = "";
  let defuddleAuthor = "";
  let defuddleContent = "";

  if (htmlResult.status === "fulfilled" && htmlResult.value) {
    const { text: html, finalUrl } = htmlResult.value;
    try {
      const result = await Defuddle(html, finalUrl, { markdown: true });
      defuddleTitle = result.title || "";
      defuddleAuthor = result.author || "";
      defuddleContent = result.content || "";
    } catch {
      // Defuddle failed, fall back to OG description
    }
  }

  const title = defuddleTitle || ogTitle || url;
  const description = ogDescription || "";
  const author = defuddleAuthor || "";
  const thumbnail = ogImage || "";
  const textContent = defuddleContent || ogDescription || "";
  const finalSource = ogSiteName || source;

  return {
    url,
    title,
    description,
    author,
    source: finalSource,
    type,
    thumbnail,
    textContent: truncateText(textContent, 4000),
  };
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "... [truncated]";
}
