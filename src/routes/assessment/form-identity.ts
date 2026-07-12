type AssessmentItemIdentity = {
	id: string;
	version: number;
};

export const assessmentItemDomKey = (item: AssessmentItemIdentity) => `${item.id}:${item.version}`;

export const assessmentChoiceControlId = (item: AssessmentItemIdentity, choiceId: string) =>
	`answer-${item.id}-${item.version}-${choiceId}`;
