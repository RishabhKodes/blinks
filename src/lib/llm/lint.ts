import { chatCompletion } from "./index";

export interface LintTopic {
  name: string;
  description: string;
  resourceCount: number;
}

export interface LintLink {
  source: string;
  target: string;
}

export interface LintResource {
  title: string;
  summary: string;
  topics: string[];
}

export interface LintFinding {
  type: "inconsistency" | "missing_connection" | "suggested_topic" | "data_quality";
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  topicName?: string;
  suggestion: string;
}

function extractJsonFromResponse(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const braceStart = raw.indexOf("[");
  const braceEnd = raw.lastIndexOf("]");
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    return raw.slice(braceStart, braceEnd + 1);
  }
  return raw.trim();
}

export async function lintKnowledgeBase(
  topics: LintTopic[],
  topicLinks: LintLink[],
  resources: LintResource[]
): Promise<LintFinding[]> {
  const topicList = topics
    .map((t) => `- ${t.name} (${t.resourceCount} resources): ${t.description.slice(0, 200) || "(no description)"}`)
    .join("\n");

  const linkList = topicLinks
    .map((l) => `- ${l.source} <-> ${l.target}`)
    .join("\n");

  const resourceList = resources
    .map((r) => `- "${r.title}" [${r.topics.join(", ")}]: ${r.summary.slice(0, 150)}`)
    .join("\n");

  const systemPrompt = `You are a knowledge base quality auditor. Analyze the knowledge base below and identify issues.

Find:
1. **inconsistency**: Conflicting information across resources or topics
2. **missing_connection**: Topics that should be linked but are not
3. **suggested_topic**: Concepts mentioned across resources that deserve their own topic
4. **data_quality**: Topics with no resources, empty descriptions, orphaned nodes, or very sparse content

For each finding, provide:
- type: one of the 4 types above
- severity: "info", "warning", or "error"
- title: short title (5-10 words)
- description: explanation of the issue
- topicName: the topic this relates to (if applicable, otherwise omit)
- suggestion: actionable fix

Respond with a JSON array of findings. Output ONLY the JSON array, no other text. If the knowledge base looks healthy, return an empty array [].`;

  const userPrompt = `## Topics (${topics.length})
${topicList || "(none)"}

## Topic Links (${topicLinks.length})
${linkList || "(none)"}

## Resources (${resources.length})
${resourceList || "(none)"}`;

  const raw = await chatCompletion(systemPrompt, userPrompt);

  try {
    const jsonStr = extractJsonFromResponse(raw);
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (f: Record<string, unknown>) =>
          typeof f.type === "string" &&
          typeof f.title === "string" &&
          typeof f.description === "string"
      )
      .map((f: Record<string, unknown>) => ({
        type: f.type as LintFinding["type"],
        severity: (f.severity as LintFinding["severity"]) || "info",
        title: f.title as string,
        description: f.description as string,
        topicName: typeof f.topicName === "string" ? f.topicName : undefined,
        suggestion: typeof f.suggestion === "string" ? f.suggestion as string : "",
      }));
  } catch {
    return [];
  }
}
