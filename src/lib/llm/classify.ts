import { chatCompletion } from "./index";
import type { FetchedContent } from "../content/fetcher";

export interface GraphContext {
  existingTopics: string[];
}

export interface ClassificationResult {
  summary: string;
  keyConcepts: string[];
  whyItMatters: string;
  connections: string[];
  topics: string[];
  topicRelationships: [string, string][];
}

function buildSystemPrompt(context: GraphContext): string {
  const topicList = context.existingTopics.length > 0
    ? `\nExisting topics in the knowledge graph: ${context.existingTopics.join(", ")}`
    : "\nThe knowledge graph is currently empty (no existing topics).";

  return `You organize web resources into a knowledge graph where TOPICS are the nodes. Topics are short concept names like "LLMs", "Fine Tuning", "React", "Agentic AI", "Transformer Architecture".

Your job: summarize the resource, assign it to 1-3 topics, and define how those topics connect to each other and to existing topics.
${topicList}

Respond with valid JSON only. Keys:

- "summary" (string): 2-4 sentence summary. An AI agent should fully understand the resource from this alone.
- "keyConcepts" (string[]): 3-6 key ideas.
- "whyItMatters" (string): 1-2 sentences on significance.
- "connections" (string[]): Format "[[Topic Name]] - how this resource relates to that topic".
- "topics" (string[]): 1-3 short topic names this resource belongs to. These become nodes in the graph. Keep them concise (1-3 words). Reuse existing topics when the concept matches.
- "topicRelationships" (string[][]): Pairs of topic names that should be linked in the graph. Each pair is [topic1, topic2]. Link topics that have a parent-child, sibling, or strong conceptual relationship. Use the EXACT topic names from your "topics" list and from existing topics. Example: [["LLMs", "Fine Tuning"], ["Fine Tuning", "LoRA"]]

RULES:
1. Topic names should be short concept labels (1-3 words), NOT URLs or full titles.
2. Reuse existing topic names when the concept matches instead of creating near-duplicates.
3. topicRelationships should only link topics that have a genuine conceptual connection.
4. Every topic in your "topics" list should appear in at least one relationship (either with another new topic or an existing one), unless the graph is empty.
5. If the graph is empty, you can still define relationships between the new topics you create.`;
}

function buildUserPrompt(content: FetchedContent, userNotes?: string): string {
  const notesSection = userNotes ? `\nUser notes: ${userNotes}\n` : "";

  return `URL: ${content.url}
Title: ${content.title}
Source: ${content.source} | Type: ${content.type} | Author: ${content.author}
Description: ${content.description}
${notesSection}
Content:
${content.textContent || "(no text extracted)"}`;
}

function extractJsonFromResponse(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  const braceStart = raw.indexOf("{");
  const braceEnd = raw.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    return raw.slice(braceStart, braceEnd + 1);
  }
  return raw.trim();
}

const FALLBACK: ClassificationResult = {
  summary: "",
  keyConcepts: [],
  whyItMatters: "",
  connections: [],
  topics: [],
  topicRelationships: [],
};

export async function classifyResource(
  content: FetchedContent,
  context: GraphContext,
  userNotes?: string
): Promise<ClassificationResult> {
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(content, userNotes);

  let rawResponse: string;
  try {
    rawResponse = await chatCompletion(systemPrompt, userPrompt);
  } catch (error) {
    console.error("LLM call failed:", error);
    return {
      ...FALLBACK,
      summary: content.description || content.title,
      topics: ["Uncategorized"],
    };
  }

  try {
    const jsonStr = extractJsonFromResponse(rawResponse);
    const parsed = JSON.parse(jsonStr);

    const topics: string[] = Array.isArray(parsed.topics) && parsed.topics.length > 0
      ? parsed.topics.filter((t: unknown) => typeof t === "string")
      : ["Uncategorized"];

    // Validate topicRelationships: each entry must be a pair of strings
    const topicRelationships: [string, string][] = Array.isArray(parsed.topicRelationships)
      ? parsed.topicRelationships.filter(
          (pair: unknown) =>
            Array.isArray(pair) &&
            pair.length === 2 &&
            typeof pair[0] === "string" &&
            typeof pair[1] === "string"
        )
      : [];

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : content.description || "",
      keyConcepts: Array.isArray(parsed.keyConcepts)
        ? parsed.keyConcepts.filter((c: unknown) => typeof c === "string")
        : [],
      whyItMatters: typeof parsed.whyItMatters === "string" ? parsed.whyItMatters : "",
      connections: Array.isArray(parsed.connections)
        ? parsed.connections.filter((c: unknown) => typeof c === "string")
        : [],
      topics,
      topicRelationships,
    };
  } catch (parseError) {
    console.error("Failed to parse LLM response:", parseError);
    return {
      ...FALLBACK,
      summary: content.description || content.title,
      topics: ["Uncategorized"],
    };
  }
}
