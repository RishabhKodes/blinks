ALTER TABLE `resource_links` ADD `relationship` text DEFAULT 'related' NOT NULL;--> statement-breakpoint
ALTER TABLE `resource_links` ADD `reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `resource_links` ADD `confidence` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `resource_links` ADD `origin` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `resource_links` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
DELETE FROM `resource_topics`
WHERE `topic_id` IN (
  SELECT `id` FROM `topics`
  WHERE lower(trim(`name`)) = 'test topic' OR lower(`id`) = 'test-topic'
);--> statement-breakpoint
DELETE FROM `topic_links`
WHERE `source_topic_id` IN (
  SELECT `id` FROM `topics`
  WHERE lower(trim(`name`)) = 'test topic' OR lower(`id`) = 'test-topic'
)
OR `target_topic_id` IN (
  SELECT `id` FROM `topics`
  WHERE lower(trim(`name`)) = 'test topic' OR lower(`id`) = 'test-topic'
);--> statement-breakpoint
DELETE FROM `topics`
WHERE lower(trim(`name`)) = 'test topic' OR lower(`id`) = 'test-topic';
