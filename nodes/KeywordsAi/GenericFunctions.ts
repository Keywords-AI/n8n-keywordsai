import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const RESPAN_API_BASE_URL = 'https://api.respan.ai/api';

export function parseJsonObject(
	context: IExecuteFunctions,
	value: string,
	label: string,
	itemIndex: number,
): IDataObject {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new NodeOperationError(context.getNode(), `${label} must contain valid JSON`, {
			itemIndex,
		});
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(context.getNode(), `${label} must be a JSON object`, {
			itemIndex,
		});
	}
	return parsed as IDataObject;
}

export function promptVersion(value: unknown): number | 'latest' | undefined {
	if (value === '' || value === undefined || value === null) return undefined;
	if (value === 'latest') return value;
	const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isSafeInteger(number) || number < 1) {
		throw new Error(
			'Prompt version must be a positive integer, latest, or empty for the deployed version',
		);
	}
	return number;
}

export async function loadCollection(
	context: ILoadOptionsFunctions,
	path: string,
	collection: string,
): Promise<IDataObject[]> {
	const firstUrl = new URL(`${RESPAN_API_BASE_URL}${path}`);
	let url: URL | undefined = firstUrl;
	const visited = new Set<string>();
	const records: IDataObject[] = [];
	while (url) {
		// Pagination is supplied by the API; credentials must stay on this collection's endpoint.
		if (url.origin !== firstUrl.origin || url.pathname !== firstUrl.pathname) {
			throw new Error('Respan returned an unexpected pagination URL');
		}
		if (visited.has(url.href)) throw new Error('Respan returned a repeated pagination URL');
		visited.add(url.href);
		const response: unknown = await context.helpers.httpRequestWithAuthentication.call(
			context,
			'keywordsAIApi',
			{ method: 'GET', url: url.href, json: true },
		);
		const envelope = response && typeof response === 'object' ? (response as IDataObject) : {};
		const rows = Array.isArray(response)
			? response
			: [envelope.results, envelope.data, envelope[collection]].find(Array.isArray);
		if (!Array.isArray(rows)) throw new Error(`Respan returned an invalid ${collection} list`);
		for (const row of rows) {
			if (row && typeof row === 'object' && !Array.isArray(row)) records.push(row as IDataObject);
		}
		url =
			typeof envelope.next === 'string' && envelope.next ? new URL(envelope.next, url) : undefined;
	}
	return records;
}
