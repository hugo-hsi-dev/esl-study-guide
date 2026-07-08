import { ADMIN_USERNAME, LEARNER_USERNAME } from '$app/env/private';
import { isAllowedAccountUsername, roleForUsername } from './roles';

export const fixedAccounts = {
	adminUsername: ADMIN_USERNAME ?? '',
	learnerUsername: LEARNER_USERNAME ?? ''
};

export const fixedAccountRoleForUsername = (username: string) =>
	roleForUsername(username, fixedAccounts);

export const isConfiguredAccountUsername = (username: string) =>
	isAllowedAccountUsername(username, fixedAccounts);
