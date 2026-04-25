import fs from "fs";
import path from "path";
import matter from "gray-matter";

const VAULT_ROOT = path.join(process.cwd(), "blinks-vault");
const TOPICS_DIR = path.join(VAULT_ROOT, "topics");

export function getVaultRoot() {
  return VAULT_ROOT;
}

export function ensureVaultStructure() {
  fs.mkdirSync(TOPICS_DIR, { recursive: true });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resourceSlug(title: string): string {
  return slugify(title).slice(0, 80);
}

// --- Topic files ---

export function getTopicDir(topicId: string): string {
  return path.join(TOPICS_DIR, topicId);
}

export function getTopicFilePath(topicId: string): string {
  return path.join(getTopicDir(topicId), "_topic.md");
}

export function getResourcesDir(topicId: string): string {
  return path.join(getTopicDir(topicId), "resources");
}

export interface TopicFrontmatter {
  id: string;
  name: string;
  description: string;
  backlinks: string[];
  resource_count: number;
  created: string;
  updated: string;
}

export function writeTopicFile(data: TopicFrontmatter, resourceList: string[]) {
  const dir = getTopicDir(data.id);
  fs.mkdirSync(path.join(dir, "resources"), { recursive: true });

  const backlinksSection = data.backlinks.length > 0
    ? `\n## Backlinks\n${data.backlinks.map((b) => `- ${b}`).join("\n")}\n`
    : "";

  const resourcesSection = resourceList.length > 0
    ? `\n## Resources\n${resourceList.map((r) => `- ${r}`).join("\n")}\n`
    : "";

  const content = `# ${data.name}

${data.description}
${resourcesSection}${backlinksSection}`;

  const fileContent = matter.stringify(content, {
    id: data.id,
    name: data.name,
    description: data.description,
    backlinks: data.backlinks,
    resource_count: data.resource_count,
    created: data.created,
    updated: data.updated,
  });

  fs.writeFileSync(getTopicFilePath(data.id), fileContent);
}

export function readTopicFile(topicId: string): { frontmatter: TopicFrontmatter; content: string } | null {
  const filePath = getTopicFilePath(topicId);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as TopicFrontmatter,
    content: parsed.content,
  };
}

// --- Resource files ---

export interface ResourceFrontmatter {
  url: string;
  title: string;
  type: string;
  author: string;
  source: string;
  thumbnail: string;
  topics: string[];
  saved: string;
}

export interface ResourceBody {
  summary: string;
  keyConcepts: string[];
  whyItMatters: string;
  connections: string[];
}

export function writeResourceFile(
  topicId: string,
  slug: string,
  frontmatter: ResourceFrontmatter,
  body: ResourceBody
) {
  const dir = getResourcesDir(topicId);
  fs.mkdirSync(dir, { recursive: true });

  const content = `# ${frontmatter.title}

## Summary
${body.summary}

## Key Concepts
${body.keyConcepts.map((c) => `- ${c}`).join("\n")}

## Why It Matters
${body.whyItMatters}

## Connections
${body.connections.map((c) => `- ${c}`).join("\n")}
`;

  const fileContent = matter.stringify(content, { ...frontmatter });
  fs.writeFileSync(path.join(dir, `${slug}.md`), fileContent);
}

export function readResourceFile(
  topicId: string,
  slug: string
): { frontmatter: ResourceFrontmatter; content: string } | null {
  const filePath = path.join(getResourcesDir(topicId), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as ResourceFrontmatter,
    content: parsed.content,
  };
}

// --- Index file ---

export interface GraphIndex {
  total_topics: number;
  total_resources: number;
  last_updated: string;
  topicTree: { name: string; resourceCount: number; backlinks: string[] }[];
}

export function writeIndexFile(index: GraphIndex) {
  const topicLines = index.topicTree
    .map((t) => `- ${t.name} (${t.resourceCount} resources)`)
    .join("\n");

  const content = `# Blinks Knowledge Graph

## Topics
${topicLines}
`;

  const fileContent = matter.stringify(content, {
    type: "blinks-index",
    total_topics: index.total_topics,
    total_resources: index.total_resources,
    last_updated: index.last_updated,
  });

  fs.writeFileSync(path.join(VAULT_ROOT, "_index.md"), fileContent);
}

// --- Graph positions ---

export interface GraphData {
  nodes: { id: string; name: string; resourceCount: number; x?: number; y?: number }[];
  links: { source: string; target: string }[];
}

export function writeGraphJson(data: GraphData) {
  fs.writeFileSync(
    path.join(VAULT_ROOT, "_graph.json"),
    JSON.stringify(data, null, 2)
  );
}

export function readGraphJson(): GraphData | null {
  const filePath = path.join(VAULT_ROOT, "_graph.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
