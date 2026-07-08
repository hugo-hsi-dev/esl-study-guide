CREATE TABLE `practice_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_user_id` text NOT NULL,
	`assessment_attempt_id` text NOT NULL,
	`practice_problem_json` text NOT NULL,
	`answer` text NOT NULL,
	`feedback_json` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`learner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessment_attempt_id`) REFERENCES `assessment_attempt`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `practice_attempt_learner_created_idx` ON `practice_attempt` (`learner_user_id`,`created_at`);