PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__new_assessment_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_user_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`definition_version` integer DEFAULT 1 NOT NULL,
	`intake_json` text DEFAULT '{"goal":"Continue studying English","selfRatings":{"speaking":1,"reading":1,"writing":1},"timeZone":"UTC"}' NOT NULL,
	`selected_items_json` text NOT NULL,
	`responses_json` text NOT NULL,
	`skill_profile_json` text,
	`study_plan_json` text,
	`diagnosis_metadata_json` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`learner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_assessment_attempt` (
	`id`,
	`learner_user_id`,
	`status`,
	`definition_version`,
	`selected_items_json`,
	`responses_json`,
	`skill_profile_json`,
	`study_plan_json`,
	`diagnosis_metadata_json`,
	`created_at`,
	`updated_at`,
	`completed_at`
)
SELECT
	`id`,
	`learner_user_id`,
	'completed',
	1,
	`selected_items_json`,
	`responses_json`,
	`skill_profile_json`,
	`study_plan_json`,
	`diagnosis_metadata_json`,
	`created_at`,
	`created_at`,
	`created_at`
FROM `assessment_attempt`;--> statement-breakpoint
CREATE TABLE `__new_practice_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_user_id` text NOT NULL,
	`assessment_attempt_id` text NOT NULL,
	`status` text DEFAULT 'answered' NOT NULL,
	`session_id` text DEFAULT '' NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`practice_problem_json` text NOT NULL,
	`answer` text,
	`feedback_json` text,
	`metadata_json` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`answered_at` integer,
	FOREIGN KEY (`learner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessment_attempt_id`) REFERENCES `__new_assessment_attempt`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_practice_attempt` (
	`id`,
	`learner_user_id`,
	`assessment_attempt_id`,
	`status`,
	`session_id`,
	`sequence`,
	`practice_problem_json`,
	`answer`,
	`feedback_json`,
	`metadata_json`,
	`created_at`,
	`answered_at`
)
SELECT
	`id`,
	`learner_user_id`,
	`assessment_attempt_id`,
	'answered',
	`id`,
	1,
	`practice_problem_json`,
	`answer`,
	`feedback_json`,
	`metadata_json`,
	`created_at`,
	`created_at`
FROM `practice_attempt`;--> statement-breakpoint
DROP TABLE `practice_attempt`;--> statement-breakpoint
DROP TABLE `assessment_attempt`;--> statement-breakpoint
ALTER TABLE `__new_assessment_attempt` RENAME TO `assessment_attempt`;--> statement-breakpoint
ALTER TABLE `__new_practice_attempt` RENAME TO `practice_attempt`;--> statement-breakpoint
CREATE INDEX `assessment_attempt_learner_created_idx` ON `assessment_attempt` (`learner_user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_attempt_one_in_progress_idx` ON `assessment_attempt` (`learner_user_id`) WHERE `status` = 'in_progress';--> statement-breakpoint
CREATE INDEX `practice_attempt_learner_created_idx` ON `practice_attempt` (`learner_user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `practice_attempt_one_presented_idx` ON `practice_attempt` (`learner_user_id`) WHERE `status` = 'presented';--> statement-breakpoint
CREATE UNIQUE INDEX `practice_attempt_session_sequence_idx` ON `practice_attempt` (`session_id`,`sequence`) WHERE `session_id` <> '';--> statement-breakpoint
PRAGMA defer_foreign_keys = off;
