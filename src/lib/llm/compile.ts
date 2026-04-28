import { chatCompletion } from "./index";

export interface CompileResource {
  title: string;
  summary: string;
  keyConcepts: string[];
  connections: string[];
}

export async function compileTopic(
  topicName: string,
  currentDescription: string,
  resources: CompileResource[],
  relatedTopics: string[]
): Promise<string> {
  const resourceSummaries = resources
    .map((r, i) => {
      const concepts = r.keyConcepts.length > 0
        ? `\n   Key concepts: ${r.keyConcepts.join(", ")}`
        : "";
      const conns = r.connections.length > 0
        ? `\n   Connections: ${r.connections.join("; ")}`
        : "";
      return `${i + 1}. "${r.title}"\n   Summary: ${r.summary}${concepts}${conns}`;
    })
    .join("\n\n");

  const relatedSection = relatedTopics.length > 0
    ? `\nRelated topics in the knowledge graph: ${relatedTopics.map((t) => `[[${t}]]`).join(", ")}`
    : "";

  const existingSection = currentDescription
    ? `\nExisting description: ${currentDescription}`
    : "";

  const systemPrompt = `You are a knowledge base curator. Your job is to synthesize multiple resource summaries into a single coherent article about a topic.

Write a comprehensive but concise article (2-5 paragraphs) that:
1. Synthesizes knowledge from ALL the resources below into a unified narrative
2. Uses [[Topic Name]] notation to cross-link to related topics
3. Includes a "## Key Insights" section with 3-6 bullet points
4. Captures the most important patterns, findings, and connections
5. Is written in a neutral, encyclopedic tone

Output ONLY the markdown article text. No frontmatter, no title header (the title is already known).`;

  const userPrompt = `Topic: ${topicName}
${existingSection}
${relatedSection}

Resources (${resources.length}):

${resourceSummaries || "(no resources yet)"}`;

  return chatCompletion(systemPrompt, userPrompt);
}
