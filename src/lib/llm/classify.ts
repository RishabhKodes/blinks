import { chatCompletion } from "./index";
import type { FetchedContent } from "../content/fetcher";
import { z } from "zod";

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

const ClassificationPayloadSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  keyConcepts: z.array(z.string()).optional(),
  whyItMatters: z.string().optional(),
  connections: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  topicRelationships: z.array(z.tuple([z.string(), z.string()])).optional(),
}).passthrough();

const RelatedResourcesPayloadSchema = z.object({
  related: z.array(
    z.object({
      index: z.number().int(),
      reason: z.string().optional(),
    })
  ).optional(),
}).passthrough();

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

function repairTruncatedJson(input: string): string {
  let text = input.trim();
  if (!text) return text;

  const firstBrace = text.indexOf("{");
  if (firstBrace > 0) {
    text = text.slice(firstBrace);
  }

  // Common truncation markers
  text = text.replace(/\.\.\.\s*(?:\[truncated\]|truncated)?\s*$/i, "");

  let out = "";
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    out += ch;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      stack.push("}");
      continue;
    }
    if (ch === "[") {
      stack.push("]");
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
      continue;
    }
  }

  // If we ended mid-string, close the quote.
  if (inString) {
    if (out.endsWith("\\")) {
      out = out.slice(0, -1);
    }
    out += "\"";
  }

  // Remove dangling comma before auto-closing structures.
  out = out.replace(/,\s*$/g, "");
  while (stack.length > 0) {
    out = out.replace(/,\s*$/g, "");
    out += stack.pop();
  }

  return out;
}

function parseJsonFromRaw(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const extracted = extractJsonFromResponse(raw);
  const firstBrace = trimmed.indexOf("{");
  const rawFromFirstBrace = firstBrace !== -1 ? trimmed.slice(firstBrace) : "";

  const candidates = [extracted, trimmed, rawFromFirstBrace]
    .map((c) => c.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((candidate) => {
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });

  if (uniqueCandidates.length === 0) {
    return null;
  }

  for (const candidate of uniqueCandidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try repaired variant below
    }

    const repaired = repairTruncatedJson(candidate);
    if (repaired !== candidate) {
      try {
        return JSON.parse(repaired);
      } catch {
        // keep trying candidates
      }
    }
  }

  return null;
}

function sanitizeTopics(topics: string[]): string[] {
  const cleaned = topics
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0);

  if (cleaned.length === 0) return ["Uncategorized"];

  const deduped = Array.from(new Set(cleaned));
  if (deduped.length === 1) {
    return [deduped[0]!, "Uncategorized"];
  }

  return deduped;
}

function toClassificationResult(
  parsed: unknown,
  content: FetchedContent
): ClassificationResult | null {
  const validation = ClassificationPayloadSchema.safeParse(parsed);
  if (!validation.success) return null;

  const data = validation.data;
  const topics = sanitizeTopics(data.topics ?? []);
  const topicRelationships = (data.topicRelationships ?? []).filter(
    ([a, b]) => a.trim().length > 0 && b.trim().length > 0
  );

  return {
    title: data.title ?? "",
    summary: data.summary?.trim() || content.description || content.title,
    keyConcepts: (data.keyConcepts ?? []).map((c) => c.trim()).filter(Boolean),
    whyItMatters: data.whyItMatters ?? "",
    connections: (data.connections ?? []).map((c) => c.trim()).filter(Boolean),
    topics,
    topicRelationships,
  };
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

  const parsed = parseJsonFromRaw(rawResponse);
  if (!parsed) {
    return [];
  }

  const validation = RelatedResourcesPayloadSchema.safeParse(parsed);
  if (!validation.success) return [];

  const related: ResourceConnection[] = [];
  for (const entry of validation.data.related ?? []) {
    const idx = entry.index;
    if (idx >= 0 && idx < existingResources.length) {
      related.push({
        resourceId: existingResources[idx]!.id,
        reason: entry.reason ?? "",
      });
    }
  }

  return related.slice(0, 3);
}

// -- Resource classification --------------------------------------------------

export async function classifyResource(
  content: FetchedContent,
  context: GraphContext,
  userNotes?: string
): Promise<ClassificationResult> {
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(content, userNotes);
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const fallbackModel = provider === "openai"
    ? (process.env.OPENAI_JSON_FALLBACK_MODEL || "gpt-5.4-mini")
    : (process.env.CLAUDE_JSON_FALLBACK_MODEL || "claude-sonnet-4-20250514");

  const attempts = [
    {
      system: systemPrompt,
      user: userPrompt,
      model: "gpt-5-mini",
      label: "initial",
    },
    {
      system: `${systemPrompt}\n\nIMPORTANT: Your previous output was malformed or truncated. Return a compact JSON object only. No markdown fences. No prose.`,
      user: userPrompt,
      model: "gpt-5-mini",
      label: "retry",
    },
    {
      system: `${systemPrompt}\n\nIMPORTANT: Return strictly valid JSON object with all required keys. Do not include markdown fences or explanatory text.`,
      user: userPrompt,
      model: fallbackModel,
      label: "fallback-model",
    },
  ] as const;

  let sawEmptyResponse = false;

  for (const attempt of attempts) {
    let rawResponse = "";
    try {
      rawResponse = await chatCompletion(attempt.system, attempt.user, attempt.model);
    } catch (error) {
      console.error(`LLM classification call failed (${attempt.label}):`, error);
      continue;
    }

    if (!rawResponse.trim()) {
      sawEmptyResponse = true;
      continue;
    }

    const parsed = parseJsonFromRaw(rawResponse);
    if (!parsed) {
      continue;
    }

    const result = toClassificationResult(parsed, content);
    if (result) {
      return result;
    }
  }

  if (sawEmptyResponse) {
    console.warn("Classification LLM returned empty response; using fallback classification.");
  } else {
    console.warn("Classification LLM returned malformed JSON; using fallback classification.");
  }

  return {
    ...FALLBACK,
    summary: content.description || content.title,
    topics: ["Uncategorized"],
  };
}
