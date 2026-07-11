import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		if (!platform?.env.DB) throw new Error('D1 binding unavailable');
		await platform.env.DB.prepare('SELECT 1').first();
		return json({
			status: 'ok',
			checks: {
				d1: 'ok',
				workersAi: platform.env.AI ? 'configured' : 'unavailable'
			}
		});
	} catch (error) {
		console.error({
			event: 'health_failed',
			error: error instanceof Error ? error.name : 'UnknownError'
		});
		return json({ status: 'unavailable' }, { status: 503 });
	}
};
