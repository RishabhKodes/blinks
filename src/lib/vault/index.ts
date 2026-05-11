export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resourceSlug(title: string): string {
  return slugify(title).slice(0, 80);
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

export function ensureVaultStructure() {}
export function writeTopicFile(_data: TopicFrontmatter, _resourceList: string[]) {}
export function writeResourceFile(
  _topicId: string,
  _slug: string,
  _frontmatter: ResourceFrontmatter,
  _body: ResourceBody
) {}
