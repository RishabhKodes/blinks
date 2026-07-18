export interface ConnectionResource {
  id: string;
  title: string;
  summary: string;
  topics: string[];
}

const PLACEHOLDER_TOPICS = new Set([
  "test topic",
]);

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "among",
  "and",
  "are",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "can",
  "could",
  "does",
  "each",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "its",
  "more",
  "most",
  "not",
  "other",
  "our",
  "out",
  "over",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "using",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

function normalizedTopicKey(topic: string): string {
  return topic.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isPlaceholderTopic(topic: string): boolean {
  return PLACEHOLDER_TOPICS.has(normalizedTopicKey(topic));
}

export function sanitizeTopicNames(topics: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawTopic of topics) {
    const topic = rawTopic.trim().replace(/\s+/g, " ");
    const key = normalizedTopicKey(topic);
    if (!topic || isPlaceholderTopic(topic) || seen.has(key)) continue;
    seen.add(key);
    result.push(topic);
  }

  return result;
}

export function canonicalResourcePair(
  resourceA: string,
  resourceB: string
): [string, string] {
  return resourceA.localeCompare(resourceB) <= 0
    ? [resourceA, resourceB]
    : [resourceB, resourceA];
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[+.#-]+|[+.#-]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  return new Set(tokens);
}

function intersectionWeight(
  left: Set<string>,
  right: Set<string>,
  documentFrequency: Map<string, number>,
  documentCount: number
): number {
  let score = 0;
  for (const token of left) {
    if (!right.has(token)) continue;
    const frequency = documentFrequency.get(token) ?? 1;
    score += Math.log((documentCount + 1) / (frequency + 1)) + 1;
  }
  return score;
}

export function rankConnectionCandidates(
  resource: ConnectionResource,
  existingResources: ConnectionResource[],
  limit = 18
): ConnectionResource[] {
  if (existingResources.length <= limit) return existingResources;

  const allResources = [resource, ...existingResources];
  const documentFrequency = new Map<string, number>();
  const tokenSets = new Map<string, Set<string>>();

  for (const item of allResources) {
    const tokens = tokenize(`${item.title} ${item.summary}`);
    tokenSets.set(item.id, tokens);
    for (const token of tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const resourceTokens = tokenSets.get(resource.id) ?? new Set<string>();
  const resourceTitleTokens = tokenize(resource.title);
  const resourceTopics = new Set(
    sanitizeTopicNames(resource.topics).map(normalizedTopicKey)
  );

  return existingResources
    .map((candidate) => {
      const candidateTokens = tokenSets.get(candidate.id) ?? new Set<string>();
      const candidateTitleTokens = tokenize(candidate.title);
      const candidateTopics = new Set(
        sanitizeTopicNames(candidate.topics).map(normalizedTopicKey)
      );

      const contentScore = intersectionWeight(
        resourceTokens,
        candidateTokens,
        documentFrequency,
        allResources.length
      );
      const titleScore = intersectionWeight(
        resourceTitleTokens,
        candidateTitleTokens,
        documentFrequency,
        allResources.length
      );

      let topicScore = 0;
      for (const topic of resourceTopics) {
        if (candidateTopics.has(topic)) topicScore += 2;
      }

      return {
        candidate,
        score: contentScore + titleScore * 2 + topicScore,
      };
    })
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
