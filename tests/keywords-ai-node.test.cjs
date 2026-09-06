const assert = require('node:assert/strict');
const { test } = require('node:test');
const { NodeApiError, NodeOperationError } = require('n8n-workflow');
const { KeywordsAi } = require('../dist/nodes/KeywordsAi/KeywordsAi.node.js');
const { KeywordsAIApi } = require('../dist/credentials/KeywordsAIApi.credentials.js');

const node = new KeywordsAi();

function execution(parameters = {}, options = {}) {
	const requests = [];
	const defaults = {
		resource: 'gateway',
		model: 'gpt-4o-mini',
		systemMessage: 'Be concise.',
		messages: { messageValues: [{ role: 'user', content: 'Hello' }] },
		additionalFields: {},
		...parameters,
	};
	const context = {
		getInputData: () => options.items ?? [{ json: {} }],
		getNodeParameter(name, index, fallback) {
			const value = defaults[name] ?? fallback;
			return typeof value === 'function' ? value(index) : value;
		},
		getNode: () => ({ name: 'Respan', type: 'keywordsAi', typeVersion: 1, parameters: defaults }),
		continueOnFail: () => options.continueOnFail ?? false,
		helpers: {
			async httpRequestWithAuthentication(credential, request) {
				requests.push({ credential, ...request });
				if (options.error) throw options.error;
				return { id: 'completion-1', choices: [{ message: { role: 'assistant', content: 'Hi' } }] };
			},
		},
	};
	return { requests, run: () => node.execute.call(context) };
}

function loader(parameters, responses) {
	const requests = [];
	const context = {
		getCurrentNodeParameter: (name) => parameters[name],
		helpers: {
			async httpRequestWithAuthentication(credential, request) {
				requests.push({ credential, ...request });
				assert.ok(responses.length, `Unexpected request: ${request.url}`);
				return responses.shift();
			},
		},
	};
	return { requests, call: (name) => node.methods.loadOptions[name].call(context) };
}

test('the Respan migration preserves existing credential and node identifiers', () => {
	const credential = new KeywordsAIApi();
	assert.equal(node.description.name, 'keywordsAi');
	assert.equal(node.description.displayName, 'Respan');
	assert.equal(credential.name, 'keywordsAIApi');
	assert.equal(credential.displayName, 'Respan API');
	assert.equal(credential.test.request.baseURL, 'https://api.respan.ai/api');
	const additional = node.description.properties.find((entry) => entry.name === 'additionalFields');
	assert.equal(
		additional.options.some((entry) => entry.name === 'stream'),
		false,
	);
});

test('Gateway uses the current API and preserves supported observability fields and item links', async () => {
	const { run, requests } = execution({
		additionalFields: {
			metadata: '{"run_id":"node-test"}',
			customerParams: '{"name":"Example"}',
			customerIdentifier: 'customer-1',
			customIdentifier: 'request-1',
			requestBreakdown: true,
			overrideParamsJson: '{"temperature":0,"max_tokens":16}',
		},
	});
	const output = await run();
	assert.equal(requests.length, 1);
	assert.equal(requests[0].baseURL, 'https://api.respan.ai/api');
	assert.equal(requests[0].url, '/chat/completions');
	assert.equal(requests[0].credential, 'keywordsAIApi');
	assert.deepEqual(requests[0].body, {
		model: 'gpt-4o-mini',
		messages: [
			{ role: 'system', content: 'Be concise.' },
			{ role: 'user', content: 'Hello' },
		],
		temperature: 0,
		max_tokens: 16,
		stream: false,
		metadata: { run_id: 'node-test' },
		customer_params: { name: 'Example' },
		customer_identifier: 'customer-1',
		custom_identifier: 'request-1',
		request_breakdown: true,
	});
	assert.deepEqual(output[0][0].pairedItem, { item: 0 });
	assert.equal(output[0][0].json.choices[0].message.content, 'Hi');
});

test('blank optional system message is omitted', async () => {
	const { run, requests } = execution({ systemMessage: '' });
	await run();
	assert.deepEqual(requests[0].body.messages, [{ role: 'user', content: 'Hello' }]);
});

test('managed prompts use schema v2 and a non-streaming patch with numeric versions', async () => {
	const { run, requests } = execution({
		resource: 'gatewayPrompt',
		promptId: 'prompt-1',
		version: '3',
		variables: { variableValues: [{ name: 'question', value: 'Hello' }] },
		additionalFields: { overrideParamsJson: '{"temperature":0.2}' },
	});
	await run();
	assert.deepEqual(requests[0].body, {
		prompt: {
			prompt_id: 'prompt-1',
			schema_version: 2,
			version: 3,
			variables: { question: 'Hello' },
			patch: { temperature: 0.2, stream: false },
		},
		stream: false,
	});
});

test('deployed prompt requests omit version and latest requests preserve the selector', async () => {
	for (const version of ['', 'latest']) {
		const { run, requests } = execution({
			resource: 'gatewayPrompt',
			promptId: 'prompt-1',
			version,
		});
		await run();
		if (version) assert.equal(requests[0].body.prompt.version, version);
		else assert.equal('version' in requests[0].body.prompt, false);
	}
});

test('invalid prompt versions and ambiguous variable names fail before making a billable request', async () => {
	for (const parameters of [
		{ version: 'invalid' },
		{ version: 0 },
		{ variables: { variableValues: [{ name: '', value: 'x' }] } },
		{
			variables: {
				variableValues: [
					{ name: 'x', value: '1' },
					{ name: 'x', value: '2' },
				],
			},
		},
	]) {
		const { run, requests } = execution({
			resource: 'gatewayPrompt',
			promptId: 'prompt-1',
			...parameters,
		});
		await assert.rejects(run, NodeOperationError);
		assert.equal(requests.length, 0);
	}
});

test('malformed JSON and non-object JSON produce field-specific configuration errors', async () => {
	for (const [key, label] of [
		['metadata', 'Metadata'],
		['customerParams', 'Customer Params'],
		['overrideParamsJson', 'Model Parameters'],
	]) {
		for (const value of ['{', '[]', 'null', 'true']) {
			const { run, requests } = execution({ additionalFields: { [key]: value } });
			await assert.rejects(
				run,
				(error) => error instanceof NodeOperationError && error.message.includes(label),
			);
			assert.equal(requests.length, 0);
		}
	}
});

test('saved streaming settings and JSON streaming overrides are rejected', async () => {
	for (const additionalFields of [{ stream: true }, { overrideParamsJson: '{"stream":true}' }]) {
		const { run, requests } = execution({ additionalFields });
		await assert.rejects(run, /Streaming is not supported/);
		assert.equal(requests.length, 0);
	}
});

test('unsupported legacy prompt overrides and message patches fail with migration guidance', async () => {
	for (const parameters of [
		{ override: true },
		{ additionalFields: { overrideParamsJson: '{"messages":[]}' } },
		{ additionalFields: { overrideParamsJson: '{"input":"Hello"}' } },
	]) {
		const { run, requests } = execution({
			resource: 'gatewayPrompt',
			promptId: 'prompt-1',
			...parameters,
		});
		await assert.rejects(run, NodeOperationError);
		assert.equal(requests.length, 0);
	}
});

test('continue-on-fail preserves the failed item index and proceeds to the next input', async () => {
	const { run, requests } = execution(
		{
			additionalFields: (index) => (index === 0 ? { metadata: '[' } : {}),
		},
		{ items: [{ json: {} }, { json: {} }], continueOnFail: true },
	);
	const output = await run();
	assert.match(output[0][0].json.error, /Metadata must contain valid JSON/);
	assert.deepEqual(
		output[0].map((item) => item.pairedItem),
		[{ item: 0 }, { item: 1 }],
	);
	assert.equal(requests.length, 1);
});

test('upstream API errors remain NodeApiErrors with the failing item index', async () => {
	const { run } = execution({}, { error: { message: 'Unauthorized', statusCode: 401 } });
	await assert.rejects(
		run,
		(error) => error instanceof NodeApiError && error.context.itemIndex === 0,
	);
});

test('prompt options support paginated and compatibility list envelopes', async () => {
	const { call, requests } = loader({}, [
		{ results: [{ prompt_id: 'a', name: 'First' }], next: '?page=2' },
		{ results: [{ id: 'b', name: 'Second' }], next: null },
	]);
	assert.deepEqual(await call('getPrompts'), [
		{ name: 'First', value: 'a' },
		{ name: 'Second', value: 'b' },
	]);
	assert.equal(requests[1].url, 'https://api.respan.ai/api/prompts/?page=2');
	for (const response of [
		[{ prompt_id: 'a' }],
		{ data: [{ prompt_id: 'a' }] },
		{ prompts: [{ prompt_id: 'a' }] },
	]) {
		assert.deepEqual(await loader({}, [response]).call('getPrompts'), [{ name: 'a', value: 'a' }]);
	}
});

test('pagination cannot forward API credentials to another host or endpoint', async () => {
	for (const next of ['https://example.org/prompts/', 'https://api.respan.ai/api/models/']) {
		const { call, requests } = loader({}, [{ results: [], next }]);
		await assert.rejects(() => call('getPrompts'), /unexpected pagination URL/);
		assert.equal(requests.length, 1);
	}
});

test('version choices distinguish the deployed version from committed versions', async () => {
	const { call } = loader({ promptId: 'a' }, [
		{
			versions: [
				{ version: 3, readonly: false },
				{ version: 2, readonly: true, is_deployed: true },
				{ version: 1, readonly: true, is_deployed: false },
			],
		},
	]);
	assert.deepEqual(await call('getVersions'), [
		{ name: 'Deployed Version', value: '' },
		{ name: 'Latest Version (Including Draft)', value: 'latest' },
		{ name: 'Version 3 (Draft)', value: 3 },
		{ name: 'Version 2 (Deployed)', value: 2 },
		{ name: 'Version 1 (Committed)', value: 1 },
	]);
});

test('latest variables resolve the highest numeric version across supported response shapes', async () => {
	for (const versions of [
		[{ version: 9 }, { version: 10 }],
		{ data: [{ version: 9 }, { version: 10 }] },
	]) {
		const { call, requests } = loader({ promptId: 'a/b', version: 'latest' }, [
			versions,
			{ variables: { question: '', context: { value: '' } } },
		]);
		assert.deepEqual(await call('getVariables'), [
			{ name: 'question', value: 'question' },
			{ name: 'context', value: 'context' },
		]);
		assert.equal(requests[1].url, '/prompts/a%2Fb/versions/10/');
	}
});

test('default variables use the deployed version and an empty latest list does not request /latest/', async () => {
	const { call, requests } = loader({ promptId: 'a', version: '' }, [
		{
			results: [
				{ version: 3, readonly: false },
				{ version: 2, readonly: true, is_deployed: true },
			],
		},
		{ variables: { question: 'Hello' } },
	]);
	assert.deepEqual(await call('getVariables'), [{ name: 'question', value: 'question' }]);
	assert.equal(requests[1].url, '/prompts/a/versions/2/');
	const empty = loader({ promptId: 'a', version: 'latest' }, [{ results: [] }]);
	assert.deepEqual(await empty.call('getVariables'), []);
	assert.equal(empty.requests.length, 1);
});
