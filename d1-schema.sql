-- Combined schema for D1

CREATE TABLE IF NOT EXISTS `topics` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `resources` (
  `id` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `title` text NOT NULL,
  `type` text DEFAULT 'other' NOT NULL,
  `author` text DEFAULT '' NOT NULL,
  `source` text DEFAULT '' NOT NULL,
  `thumbnail` text DEFAULT '' NOT NULL,
  `summary` text DEFAULT '' NOT NULL,
  `saved_at` text NOT NULL,
  `archived_at` text
);

CREATE UNIQUE INDEX IF NOT EXISTS `resources_url_unique` ON `resources` (`url`);

CREATE TABLE IF NOT EXISTS `resource_topics` (
  `resource_id` text NOT NULL,
  `topic_id` text NOT NULL,
  FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `topic_links` (
  `source_topic_id` text NOT NULL,
  `target_topic_id` text NOT NULL,
  FOREIGN KEY (`source_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`target_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `resource_links` (
  `source_resource_id` text NOT NULL,
  `target_resource_id` text NOT NULL,
  `relationship` text DEFAULT 'related' NOT NULL,
  `reason` text DEFAULT '' NOT NULL,
  `confidence` integer DEFAULT 100 NOT NULL,
  `origin` text DEFAULT 'legacy' NOT NULL,
  `created_at` text DEFAULT '' NOT NULL,
  FOREIGN KEY (`source_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`target_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `graph_positions` (
  `topic_id` text PRIMARY KEY NOT NULL,
  `x` integer DEFAULT 0 NOT NULL,
  `y` integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS `wiki_compilations` (
  `topic_id` text PRIMARY KEY NOT NULL,
  `compiled_at` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `lint_results` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `severity` text DEFAULT 'info' NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `topic_id` text,
  `suggestion` text DEFAULT '' NOT NULL,
  `resolved` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL
);
