import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(), // slug, e.g. "llms"
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(), // uuid
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull().default("other"), // article, tweet, video, repo, podcast, other
  author: text("author").notNull().default(""),
  source: text("source").notNull().default(""), // arxiv, twitter, youtube, github, medium
  thumbnail: text("thumbnail").notNull().default(""),
  summary: text("summary").notNull().default(""),
  savedAt: text("saved_at").notNull(),
  archivedAt: text("archived_at"),
});

export const resourceTopics = sqliteTable("resource_topics", {
  resourceId: text("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
});

export const topicLinks = sqliteTable("topic_links", {
  sourceTopicId: text("source_topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  targetTopicId: text("target_topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
});

export const resourceLinks = sqliteTable("resource_links", {
  sourceResourceId: text("source_resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  targetResourceId: text("target_resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
});

export const graphPositions = sqliteTable("graph_positions", {
  nodeId: text("topic_id").primaryKey(), // column still named topic_id in SQL, stores resource IDs
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
});

export const wikiCompilations = sqliteTable("wiki_compilations", {
  topicId: text("topic_id")
    .primaryKey()
    .references(() => topics.id, { onDelete: "cascade" }),
  compiledAt: text("compiled_at").notNull(),
  status: text("status").notNull().default("pending"), // pending | compiled | error
});

export const lintResults = sqliteTable("lint_results", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // inconsistency | missing_connection | suggested_topic | data_quality
  severity: text("severity").notNull().default("info"), // info | warning | error
  title: text("title").notNull(),
  description: text("description").notNull(),
  topicId: text("topic_id"),
  suggestion: text("suggestion").notNull().default(""),
  resolved: integer("resolved").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
