CREATE TABLE `assessment_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_user_id` text NOT NULL,
	`status` text DEFAULT 'pending_skill_diagnosis' NOT NULL,
	`selected_items_json` text NOT NULL,
	`responses_json` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`learner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assessment_attempt_learner_created_idx` ON `assessment_attempt` (`learner_user_id`,`created_at`);