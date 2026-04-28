export interface QATopic {
  name: string;
  description: string;
  resourceCount: number;
}

export interface QAResource {
  title: string;
  summary: string;
  url: string;
  source: string;
  type: string;
  topics: string[];
}

export interface QALink {
  source: string;
  target: string;
}

export function buildQASystemPrompt(
  topics: QATopic[],
  resources: QAResource[],
  topicLinks: QALink[]
): string {
  const topicIndex = topics
    .map((t) => {
      const desc = t.description ? `: ${t.description.slice(0, 500)}` : "";
      return `- [[${t.name}]] (${t.resourceCount} resources)${desc}`;
    })
    .join("\n");

  const resourceIndex = resources
    .map((r) => {
      const topicTags = r.topics.map((t) => `[[${t}]]`).join(", ");
      return `- "${r.title}" (${r.source}/${r.type}) [${topicTags}]: ${r.summary}`;
    })
    .join("\n");

  const linkList = topicLinks
    .map((l) => `- [[${l.source}]] <-> [[${l.target}]]`)
    .join("\n");

  return `You are a knowledgeable research assistant for a personal knowledge base. Answer questions using ONLY the knowledge base contents below. Be thorough but concise.

When referencing topics, use [[Topic Name]] notation. When referencing resources, mention them by title.

If the knowledge base does not contain enough information to answer, say so clearly and suggest what additional resources might help.

## Knowledge Base

### Topics (${topics.length} total)
${topicIndex || "(no topics yet)"}

### Resources (${resources.length} total)
${resourceIndex || "(no resources yet)"}

### Topic Connections
${linkList || "(no connections yet)"}`;
}
