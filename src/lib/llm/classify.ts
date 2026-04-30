import { chatCompletion } from "./index";
import type { FetchedContent } from "../content/fetcher";

export interface GraphContext {
  existingTopics: string[];
}

export interface ClassificationResult {
  title: string;
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

  return `You organize web resources into a knowledge graph. Topics are short concept names like "LLMs", "Fine Tuning", "React", "Agentic AI", "Transformer Architecture". Resources that share topics become connected in the graph.
${topicList}

Respond with valid JSON only. Keys:

- "title" (string): A clear, concise title for this resource (5-12 words). NOT the URL. Describe what the resource is about.
- "summary" (string): 2-4 sentence summary. An AI agent should fully understand the resource from this alone.
- "keyConcepts" (string[]): 3-6 key ideas.
- "whyItMatters" (string): 1-2 sentences on significance.
- "connections" (string[]): Format "[[Topic Name]] - how this resource relates to that topic".
- "topics" (string[]): 2-3 short topic names this resource belongs to. These are used to connect related resources in the graph. Keep them concise (1-3 words). You MUST reuse existing topics when the concept is relevant -- this is how resources get connected to each other.
- "topicRelationships" (string[][]): Pairs of topic names that should be linked. Each pair is [topic1, topic2]. Use EXACT topic names from your "topics" list and from existing topics. Example: [["LLMs", "Fine Tuning"], ["Fine Tuning", "LoRA"]]

RULES:
1. Topic names should be short concept labels (1-3 words), NOT URLs or full titles.
2. ALWAYS assign at least 2 topics. At least one MUST be an existing topic if any existing topic is even loosely relevant. This ensures new resources connect to the graph.
3. Only create a new topic when no existing topic covers the concept.
4. topicRelationships should only link topics that have a genuine conceptual connection.
5. Every topic in your "topics" list should appear in at least one relationship (either with another new topic or an existing one), unless the graph is empty.`;
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
  title: "",
  summary: "",
  keyConcepts: [],
  whyItMatters: "",
  connections: [],
  topics: [],
  topicRelationships: [],
};

// -- LLM-judged resource connections ------------------------------------------

export interface ExistingResource {
  id: string;
  title: string;
  summary: string;
  topics: string[];
}

export interface ResourceConnection {
  resourceId: string;
  reason: string;
}

export async function findRelatedResources(
  newResource: { title: string; summary: string; topics: string[] },
  existingResources: ExistingResource[]
): Promise<ResourceConnection[]> {
  if (existingResources.length === 0) return [];

  const listing = existingResources
    .map((r, i) => `[${i}] "${r.title}" - ${r.summary} (topics: ${r.topics.join(", ")})`)
    .join("\n");

  const systemPrompt = `You decide which existing resources in a knowledge graph are genuinely related to a newly added resource.

Rules:
- Only pick resources with a REAL conceptual connection (shared domain, complementary ideas, same technology, continuation of a theme).
- Do NOT connect resources that merely share a broad category like "AI" or "technology".
- Return at most 3 connections. Fewer is fine. Zero is fine if nothing is truly related.
- Respond with valid JSON only: { "related": [{ "index": <number>, "reason": "<1 sentence>" }, ...] }
- "index" is the number in brackets from the list below.`;

  const userPrompt = `NEW RESOURCE:
Title: ${newResource.title}
Summary: ${newResource.summary}
Topics: ${newResource.topics.join(", ")}

EXISTING RESOURCES:
${listing}`;

  let rawResponse: string;
  try {
    rawResponse = await chatCompletion(systemPrompt, userPrompt, "gpt-5-nano");
  } catch (error) {
    console.error("LLM connection call failed:", error);
    return [];
  }

  try {
    const jsonStr = extractJsonFromResponse(rawResponse);
    const parsed = JSON.parse(jsonStr);
    const related: ResourceConnection[] = [];

    if (Array.isArray(parsed.related)) {
      for (const entry of parsed.related) {
        const idx = typeof entry.index === "number" ? entry.index : -1;
        if (idx >= 0 && idx < existingResources.length) {
          related.push({
            resourceId: existingResources[idx]!.id,
            reason: typeof entry.reason === "string" ? entry.reason : "",
          });
        }
      }
    }

    return related.slice(0, 3);
  } catch (parseError) {
    console.error("Failed to parse LLM connection response:", parseError);
    return [];
  }
}

// -- Resource classification --------------------------------------------------

export async function classifyResource(
  content: FetchedContent,
  context: GraphContext,
  userNotes?: string
): Promise<ClassificationResult> {
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(content, userNotes);

  let rawResponse: string;
  try {
    rawResponse = await chatCompletion(systemPrompt, userPrompt, "gpt-5-mini");
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
      title: typeof parsed.title === "string" ? parsed.title : "",
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
