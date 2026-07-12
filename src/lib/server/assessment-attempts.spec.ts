import { describe, expect, it } from 'vitest';
import {
	assessmentBaselineAvailability,
	assessmentIntakeSchema,
	assessmentFormIdFromSelectedItems,
	authorizeAssessmentResponse,
	buildAssessmentResponseDraft,
	defaultPlacementTestProfile,
	getAssessmentState,
	hasAllSelectedResponses,
	nextAssessmentFormId,
	selectAssessmentItems,
	saveAssessmentAttempt,
	startAssessment
} from './assessment-attempts';
import { getAssessmentItemVersion, getLearnerAssessmentItems } from './assessment-items';
import type { Db } from './db';
import type { AttemptResponse, AttemptSelectedItem, PlacementTestProfile } from './db/schema';

const includesSqlParameter = (
	value: unknown,
	expected: string,
	visited = new Set<object>()
): boolean => {
	if (value === expected) return true;
	if (!value || typeof value !== 'object') return false;
	if (visited.has(value)) return false;
	visited.add(value);
	return Object.values(value).some((entry) => includesSqlParameter(entry, expected, visited));
};

describe('assessmentIntakeSchema', () => {
	it('adds a not-sure placement profile to legacy intake data', () => {
		expect.assertions(1);

		const intake = assessmentIntakeSchema.parse({
			goal: 'Use English at school',
			selfRatings: { speaking: 2, reading: 3, writing: 2 },
			timeZone: 'America/New_York'
		});

		expect(intake.placementTest).toEqual(defaultPlacementTestProfile);
	});

	it('normalizes a placement-test profile without treating it as an official score', () => {
		expect.assertions(1);

		const intake = assessmentIntakeSchema.parse({
			goal: 'Prepare for college ESL placement',
			selfRatings: { speaking: 3, reading: 4, writing: 3 },
			timeZone: 'America/New_York',
			placementTest: {
				kind: 'accuplacer_esl',
				institution: '  City Community College  ',
				targetOutcome: '  ESL Level 3  ',
				testDate: '2026-08-15'
			}
		});

		expect(intake.placementTest).toEqual({
			kind: 'accuplacer_esl',
			institution: 'City Community College',
			targetOutcome: 'ESL Level 3',
			knownSections: '',
			testDate: '2026-08-15'
		});
	});

	it('rejects an unsupported placement-test kind', () => {
		expect.assertions(2);

		expect(() =>
			assessmentIntakeSchema.parse({
				goal: 'Prepare for placement',
				selfRatings: { speaking: 3, reading: 3, writing: 3 },
				timeZone: 'UTC',
				placementTest: {
					kind: 'generic_pass_prediction',
					institution: '',
					targetOutcome: ''
				}
			})
		).toThrow();
		expect(() =>
			assessmentIntakeSchema.parse({
				goal: 'Prepare for placement',
				selfRatings: { speaking: 3, reading: 3, writing: 3 },
				timeZone: 'UTC',
				placementTest: {
					kind: 'school_specific',
					institution: 'Example School',
					targetOutcome: 'Level 2',
					testDate: '2026-02-31'
				}
			})
		).toThrow('Use a valid test date.');
	});
});

describe('saveAssessmentAttempt', () => {
	it('rejects an assessment attempt owned by another learner', async () => {
		expect.assertions(2);
		const item = getLearnerAssessmentItems()[0];
		if (!item) throw new Error('Expected an assessment item.');
		const foreignAttempt = {
			id: 'attempt-1',
			learnerUserId: 'other-learner',
			status: 'in_progress' as const,
			definitionVersion: 2,
			intakeJson: {
				goal: 'Use English at work',
				selfRatings: { speaking: 3, reading: 3, writing: 3 },
				timeZone: 'UTC'
			},
			selectedItemsJson: [{ id: item.id, version: item.version, area: item.area }],
			responsesJson: [],
			skillProfileJson: null,
			studyPlanJson: null,
			diagnosisMetadataJson: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			completedAt: null
		};
		let queriedWithLearnerOwnership = false;
		const db = {
			select: () => ({
				from: () => ({
					where: (condition: unknown) => {
						queriedWithLearnerOwnership = includesSqlParameter(condition, 'learner-1');
						return {
							limit: async () => (queriedWithLearnerOwnership ? [] : [foreignAttempt])
						};
					}
				})
			})
		} as unknown as Db;

		await expect(
			authorizeAssessmentResponse(db, 'learner-1', {
				attemptId: foreignAttempt.id,
				itemId: item.id
			})
		).rejects.toThrow('Assessment attempt was not found.');
		expect(queriedWithLearnerOwnership).toBe(true);
	});

	it('saves one completed 14-task attempt with honest limited diagnosis', async () => {
		expect.assertions(12);

		const formData = new FormData();
		for (const item of getLearnerAssessmentItems()) {
			if (item.area === 'writing') {
				formData.set(
					`answer:${item.id}`,
					'Last week I fixed a bill. I called support. They helped me.'
				);
			} else if (item.area === 'speaking') {
				formData.set(`speakingSeconds:${item.id}`, '42');
			} else {
				formData.set(`answer:${item.id}`, item.learnerTask.choices?.[0]?.id ?? '');
			}
		}

		const rows: unknown[] = [];
		const db = {
			insert: () => ({
				values: async (row: unknown) => {
					rows.push(row);
				}
			})
		} as unknown as Pick<Db, 'insert'>;

		const result = await saveAssessmentAttempt(db, 'learner-1', formData);
		const row = rows[0] as {
			learnerUserId: string;
			status: string;
			selectedItemsJson: { area: string }[];
			responsesJson: { area: string; kind: string; metadata?: unknown }[];
			skillProfileJson: {
				skillBands: Record<string, string>;
				priorityWeaknesses: { signal: string }[];
				rubricOutputs: { pronunciation: { score: null; feedback: string } };
			};
			studyPlanJson: { reassessAfterPracticeCount: number };
			diagnosisMetadataJson: {
				modelId: string;
				schemaVersion: number;
				fallbackReason?: string;
			};
		};

		expect(row.learnerUserId).toBe('learner-1');
		expect(row.status).toBe('completed');
		expect([...new Set(row.selectedItemsJson.map((item) => item.area))].sort()).toEqual([
			'grammar_usage',
			'listening',
			'reading',
			'speaking',
			'vocabulary',
			'writing'
		]);
		expect(row.responsesJson).toHaveLength(14);
		expect(row.responsesJson.find((response) => response.area === 'writing')?.kind).toBe(
			'writing_text'
		);
		expect(row.responsesJson.find((response) => response.area === 'speaking')).toEqual({
			area: 'speaking',
			itemId: 'speak-recent-purchase',
			itemVersion: 1,
			kind: 'speaking_metadata',
			metadata: { representedBy: 'temporary_metadata', responseSeconds: 42 }
		});
		expect(row.skillProfileJson.skillBands.writing).toBe('insufficient_evidence');
		expect(row.skillProfileJson.priorityWeaknesses.length).toBeGreaterThan(0);
		expect(row.skillProfileJson.rubricOutputs.pronunciation).toEqual({
			score: null,
			signals: [],
			feedback:
				'Pronunciation scoring is deferred; speaking feedback uses transcript-level surface analysis.'
		});
		expect(row.studyPlanJson.reassessAfterPracticeCount).toBe(20);
		expect(row.diagnosisMetadataJson).toMatchObject({
			modelId: 'deterministic-objective-scoring',
			schemaVersion: 2,
			fallbackReason: 'workers_ai_unavailable'
		});
		expect(result.status).toBe('completed');
	});
});

const responsesFor = (profile: PlacementTestProfile): AttemptResponse[] =>
	selectAssessmentItems(profile).map((selected) => {
		const item = getAssessmentItemVersion(selected.id, selected.version)!;
		if (item.area === 'writing') {
			return {
				area: 'writing',
				itemId: item.id,
				itemVersion: item.version,
				kind: 'writing_text',
				answer: 'A reviewable response.'
			};
		}
		if (item.area === 'speaking') {
			return {
				area: 'speaking',
				itemId: item.id,
				itemVersion: item.version,
				kind: 'speaking_metadata',
				metadata: { representedBy: 'temporary_metadata', responseSeconds: 20 }
			};
		}
		return {
			area: item.area,
			itemId: item.id,
			itemVersion: item.version,
			kind: 'objective',
			answer: item.answerKey![0]
		};
	});

describe('profile-aware assessment selection', () => {
	it.each([
		['not_sure', '', 14],
		['not_sure', 'Reading', 3],
		['not_sure', 'Reading and mathematics', 3],
		['not_sure', 'Reading and essay', 4],
		['not_sure', 'Mathematics', 14],
		['school_specific', '', 14],
		['school_specific', 'Listening and writing', 4],
		['school_specific', 'Reading and language use', 6],
		['accuplacer_esl', '', 20],
		['accuplacer_esl', 'Listening and WritePlacer ESL', 6],
		['accuplacer_esl', 'Sentence Meaning', 5],
		['cambridge_cept', 'Listening', 5],
		['cambridge_cept', 'Reading', 15],
		['cambridge_cept', 'Reading and Listening', 20]
	] as const)('selects %s / %s as %i tasks', (kind, knownSections, expectedCount) => {
		const profile: PlacementTestProfile = {
			kind,
			institution: '',
			targetOutcome: '',
			knownSections
		};
		expect(selectAssessmentItems(profile)).toHaveLength(expectedCount);
	});

	it.each([
		{ ...defaultPlacementTestProfile },
		{
			kind: 'school_specific' as const,
			institution: 'Example College',
			targetOutcome: '',
			knownSections: 'Listening'
		},
		{
			kind: 'accuplacer_esl' as const,
			institution: '',
			targetOutcome: '',
			knownSections: ''
		},
		{
			kind: 'cambridge_cept' as const,
			institution: '',
			targetOutcome: '',
			knownSections: ''
		}
	])('uses the selected response keys instead of a global task count', (profile) => {
		const selected = selectAssessmentItems(profile);
		const responses = responsesFor(profile);

		expect(hasAllSelectedResponses(selected, responses)).toBe(true);
		expect(hasAllSelectedResponses(selected, responses.slice(0, -1))).toBe(false);
	});

	it('accepts and trims a CEPT open-gap response without requiring a choice id', async () => {
		const formData = new FormData();
		formData.set('answer:cept-open-gap-intended-for', '  WOULD  ');

		await expect(
			buildAssessmentResponseDraft('cept-open-gap-intended-for', formData)
		).resolves.toEqual({ kind: 'objective', answer: 'WOULD' });
	});

	it.each([
		['not_sure', '', ''],
		['school_specific', 'Listening and writing', ''],
		['accuplacer_esl', '', ''],
		['accuplacer_esl', 'Sentence Meaning', ''],
		['accuplacer_esl', 'Listening and WritePlacer ESL', 'WritePlacer readiness'],
		['cambridge_cept', '', ''],
		['cambridge_cept', 'Listening', ''],
		['cambridge_cept', 'Reading', '']
	] as const)(
		'has zero item-id overlap between forms for %s / %s',
		(kind, knownSections, targetOutcome) => {
			const profile: PlacementTestProfile = {
				kind,
				institution: '',
				targetOutcome,
				knownSections
			};
			const formA = selectAssessmentItems(profile, 'A');
			const formB = selectAssessmentItems(profile, 'B');
			const formAIds = new Set(formA.map((item) => item.id));

			expect(formA).toHaveLength(formB.length);
			expect(formA.every((item) => item.formId === 'A')).toBe(true);
			expect(formB.every((item) => item.formId === 'B')).toBe(true);
			expect(formB.filter((item) => formAIds.has(item.id))).toHaveLength(0);
		}
	);

	it('selects A, then an unused B, then reports exhaustion without cycling', () => {
		const formA = selectAssessmentItems(defaultPlacementTestProfile, 'A');
		const formB = selectAssessmentItems(defaultPlacementTestProfile, 'B');
		const legacyFormA = formA.map(({ formId, ...item }) => {
			void formId;
			return item;
		});

		expect(assessmentFormIdFromSelectedItems(legacyFormA)).toBe('A');
		expect(nextAssessmentFormId(defaultPlacementTestProfile)).toBe('A');
		expect(nextAssessmentFormId(defaultPlacementTestProfile, [legacyFormA])).toBe('B');
		expect(nextAssessmentFormId(defaultPlacementTestProfile, [legacyFormA, formB])).toBeNull();
		expect(nextAssessmentFormId(defaultPlacementTestProfile, [formB, formA])).toBeNull();
	});

	it('fails closed for a completed row that mixes alternate forms', () => {
		const mixed = [
			selectAssessmentItems(defaultPlacementTestProfile, 'A')[0]!,
			selectAssessmentItems(defaultPlacementTestProfile, 'B')[0]!
		];

		expect(() => assessmentFormIdFromSelectedItems(mixed)).toThrow(
			'Assessment attempt mixes alternate forms.'
		);
		expect(() => nextAssessmentFormId(defaultPlacementTestProfile, [mixed])).toThrow(
			'Assessment attempt mixes alternate forms.'
		);
	});

	it('allows a different profile whose candidate items have never been disclosed', () => {
		const previousAccuplacer = selectAssessmentItems(
			{
				kind: 'accuplacer_esl',
				institution: '',
				targetOutcome: '',
				knownSections: ''
			},
			'A'
		);
		const writingAndSpeakingProfile: PlacementTestProfile = {
			kind: 'school_specific',
			institution: 'Example School',
			targetOutcome: '',
			knownSections: 'Writing and speaking'
		};

		expect(nextAssessmentFormId(writingAndSpeakingProfile, [previousAccuplacer])).toBe('A');
		expect(
			selectAssessmentItems(writingAndSpeakingProfile, 'A').filter((candidate) =>
				previousAccuplacer.some((disclosed) => disclosed.id === candidate.id)
			)
		).toHaveLength(0);
	});

	it('rejects a candidate form when even one item was disclosed and chooses a zero-overlap form', () => {
		const listeningProfile: PlacementTestProfile = {
			kind: 'school_specific',
			institution: 'Example School',
			targetOutcome: '',
			knownSections: 'Listening'
		};
		const expandedProfile: PlacementTestProfile = {
			...listeningProfile,
			knownSections: 'Listening and writing'
		};
		const disclosed = selectAssessmentItems(listeningProfile, 'A');
		const selectedFormId = nextAssessmentFormId(expandedProfile, [disclosed]);
		const selected = selectAssessmentItems(expandedProfile, selectedFormId ?? 'A');

		expect(selectedFormId).toBe('B');
		expect(selected.filter((item) => disclosed.some((prior) => prior.id === item.id))).toHaveLength(
			0
		);
	});

	it('separates same-target exhaustion from an available changed-profile subset', () => {
		const accuplacerProfile: PlacementTestProfile = {
			kind: 'accuplacer_esl',
			institution: '',
			targetOutcome: '',
			knownSections: ''
		};
		const completedItems = [
			selectAssessmentItems(accuplacerProfile, 'A'),
			selectAssessmentItems(accuplacerProfile, 'B')
		];

		expect(assessmentBaselineAvailability(accuplacerProfile, completedItems)).toEqual({
			sameTargetAvailable: false,
			anyBaselineAvailable: true
		});
	});

	it('reports no baseline option after every selectable item family was disclosed', () => {
		const accuplacerWithWriting: PlacementTestProfile = {
			kind: 'accuplacer_esl',
			institution: '',
			targetOutcome: 'WritePlacer readiness',
			knownSections: ''
		};
		const cept: PlacementTestProfile = {
			kind: 'cambridge_cept',
			institution: '',
			targetOutcome: '',
			knownSections: ''
		};
		const school: PlacementTestProfile = {
			kind: 'school_specific',
			institution: '',
			targetOutcome: '',
			knownSections: ''
		};
		const completedItems = [
			selectAssessmentItems(accuplacerWithWriting, 'A'),
			selectAssessmentItems(accuplacerWithWriting, 'B'),
			selectAssessmentItems(cept, 'A'),
			selectAssessmentItems(cept, 'B'),
			selectAssessmentItems(school, 'A'),
			selectAssessmentItems(school, 'B')
		];

		expect(assessmentBaselineAvailability(defaultPlacementTestProfile, completedItems)).toEqual({
			sameTargetAvailable: false,
			anyBaselineAvailable: false
		});
	});

	const now = new Date('2026-07-11T12:00:00.000Z');
	const intake = assessmentIntakeSchema.parse({
		goal: 'Prepare for college ESL placement',
		selfRatings: { speaking: 3, reading: 3, writing: 3 },
		timeZone: 'UTC',
		placementTest: defaultPlacementTestProfile
	});
	const completedAttempt = (
		id: string,
		selectedItemsJson: AttemptSelectedItem[],
		completedIntake = intake
	) => ({
		id,
		learnerUserId: 'learner-1',
		status: 'completed' as const,
		definitionVersion: 5,
		intakeJson: completedIntake,
		selectedItemsJson,
		responsesJson: [],
		skillProfileJson: null,
		studyPlanJson: null,
		diagnosisMetadataJson: null,
		createdAt: now,
		updatedAt: now,
		completedAt: now
	});
	const startDb = (completedAttempts: ReturnType<typeof completedAttempt>[]) => {
		let selectedCall = 0;
		const insertedRows: Record<string, unknown>[] = [];
		const db = {
			select: () => {
				selectedCall += 1;
				const call = selectedCall;
				const chain = {
					from: () => chain,
					where: () => chain,
					orderBy: () => (call === 2 ? Promise.resolve(completedAttempts) : chain),
					limit: async () => {
						if (call === 1) return [];
						return insertedRows.length ? [insertedRows[0]] : [];
					}
				};
				return chain;
			},
			insert: () => ({
				values: async (row: Record<string, unknown>) => {
					insertedRows.push({
						...row,
						skillProfileJson: null,
						studyPlanJson: null,
						diagnosisMetadataJson: null,
						createdAt: now,
						updatedAt: now,
						completedAt: null
					});
				}
			})
		} as unknown as Db;
		return { db, insertedRows };
	};

	it('exposes alternate-form availability and the practice recommendation in completed state', async () => {
		const completed = completedAttempt(
			'completed-a',
			selectAssessmentItems(defaultPlacementTestProfile, 'A')
		);
		let selectCall = 0;
		const db = {
			select: () => {
				selectCall += 1;
				const call = selectCall;
				const chain = {
					from: () => chain,
					where: () => chain,
					orderBy: () => (call === 3 ? Promise.resolve([completed]) : chain),
					limit: async () => (call === 1 ? [] : [completed])
				};
				return chain;
			}
		} as unknown as Db;

		await expect(
			getAssessmentState(db, 'learner-1', {
				reassessmentContext: { assessmentAttemptId: completed.id, recommended: true }
			})
		).resolves.toMatchObject({
			status: 'completed',
			reassessment: {
				sameTargetAvailable: true,
				anyBaselineAvailable: true,
				recommended: true
			}
		});
	});

	it('starts the first reassessment on form B after a completed legacy form-A baseline', async () => {
		const baselineItems = selectAssessmentItems(defaultPlacementTestProfile, 'A').map(
			({ formId, ...item }) => {
				void formId;
				return item;
			}
		);
		const completedBaseline = completedAttempt('completed-baseline', baselineItems);
		const { db, insertedRows } = startDb([completedBaseline]);

		const state = await startAssessment(db, 'learner-1', intake, {
			reassessmentContext: {
				assessmentAttemptId: completedBaseline.id,
				recommended: true
			}
		});
		const selected = (insertedRows[0]?.selectedItemsJson ?? []) as {
			id: string;
			formId?: string;
		}[];
		const baselineIds = new Set(completedBaseline.selectedItemsJson.map((item) => item.id));

		expect(state.formId).toBe('B');
		expect(selected).toHaveLength(14);
		expect(selected.every((item) => item.formId === 'B')).toBe(true);
		expect(selected.filter((item) => baselineIds.has(item.id))).toHaveLength(0);
	});

	it('protects an undisclosed same-target form until practice recommends reassessment', async () => {
		const completedBaseline = completedAttempt(
			'completed-baseline',
			selectAssessmentItems(defaultPlacementTestProfile, 'A')
		);
		const { db, insertedRows } = startDb([completedBaseline]);

		await expect(startAssessment(db, 'learner-1', intake)).rejects.toThrow(
			'Keep practicing this same target until Progress recommends reassessment.'
		);
		expect(insertedRows).toHaveLength(0);
	});

	it('protects a historical same target when a different completed target is interposed', async () => {
		const priorSameTarget = completedAttempt(
			'completed-original-target',
			selectAssessmentItems(defaultPlacementTestProfile, 'A')
		);
		const differentProfile: PlacementTestProfile = {
			kind: 'school_specific',
			institution: 'Example College',
			targetOutcome: '',
			knownSections: 'Writing'
		};
		const differentIntake = assessmentIntakeSchema.parse({
			...intake,
			placementTest: differentProfile
		});
		const interposedTarget = completedAttempt(
			'completed-interposed-target',
			selectAssessmentItems(differentProfile, 'A'),
			differentIntake
		);
		const { db, insertedRows } = startDb([interposedTarget, priorSameTarget]);

		await expect(startAssessment(db, 'learner-1', intake)).rejects.toThrow(
			'Keep practicing this same target until Progress recommends reassessment.'
		);
		expect(insertedRows).toHaveLength(0);
	});

	it('does not let a recommendation for an interposed target authorize a historical target', async () => {
		const priorSameTarget = completedAttempt(
			'completed-original-target',
			selectAssessmentItems(defaultPlacementTestProfile, 'A')
		);
		const differentProfile: PlacementTestProfile = {
			kind: 'school_specific',
			institution: 'Example College',
			targetOutcome: '',
			knownSections: 'Writing'
		};
		const differentIntake = assessmentIntakeSchema.parse({
			...intake,
			placementTest: differentProfile
		});
		const interposedTarget = completedAttempt(
			'completed-interposed-target',
			selectAssessmentItems(differentProfile, 'A'),
			differentIntake
		);
		const { db, insertedRows } = startDb([interposedTarget, priorSameTarget]);

		await expect(
			startAssessment(db, 'learner-1', intake, {
				reassessmentContext: {
					assessmentAttemptId: interposedTarget.id,
					recommended: true
				}
			})
		).rejects.toThrow('Keep practicing this same target until Progress recommends reassessment.');
		expect(insertedRows).toHaveLength(0);
	});

	it('still allows a genuinely different undisclosed target without a reassessment recommendation', async () => {
		const completedBaseline = completedAttempt(
			'completed-baseline',
			selectAssessmentItems(defaultPlacementTestProfile, 'A')
		);
		const differentProfile: PlacementTestProfile = {
			kind: 'school_specific',
			institution: 'Example College',
			targetOutcome: '',
			knownSections: 'Writing'
		};
		const differentIntake = assessmentIntakeSchema.parse({
			...intake,
			placementTest: differentProfile
		});
		const { db, insertedRows } = startDb([completedBaseline]);

		const state = await startAssessment(db, 'learner-1', differentIntake);
		const selected = (insertedRows[0]?.selectedItemsJson ?? []) as AttemptSelectedItem[];

		expect(state.formId).toBe('B');
		expect(selected).toHaveLength(1);
		expect(selected[0]).toMatchObject({ area: 'writing', formId: 'B' });
	});

	it('rejects a third same-profile start after A and B were disclosed, regardless of history order', async () => {
		const completedA = completedAttempt(
			'completed-a',
			selectAssessmentItems(defaultPlacementTestProfile, 'A')
		);
		const completedB = completedAttempt(
			'completed-b',
			selectAssessmentItems(defaultPlacementTestProfile, 'B')
		);
		const { db, insertedRows } = startDb([completedA, completedB]);

		await expect(startAssessment(db, 'learner-1', intake)).rejects.toThrow(
			'No reviewed form made entirely of undisclosed tasks remains for this selected profile and section set.'
		);
		expect(insertedRows).toHaveLength(0);
	});
});
