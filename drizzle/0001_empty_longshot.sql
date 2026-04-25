CREATE TABLE `resource_links` (
	`source_resource_id` text NOT NULL,
	`target_resource_id` text NOT NULL,
	FOREIGN KEY (`source_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_graph_positions` (
	`topic_id` text PRIMARY KEY NOT NULL,
	`x` integer DEFAULT 0 NOT NULL,
	`y` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_graph_positions`("topic_id", "x", "y") SELECT "topic_id", "x", "y" FROM `graph_positions`;--> statement-breakpoint
DROP TABLE `graph_positions`;--> statement-breakpoint
ALTER TABLE `__new_graph_positions` RENAME TO `graph_positions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;