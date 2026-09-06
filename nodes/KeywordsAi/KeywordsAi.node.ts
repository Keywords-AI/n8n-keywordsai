import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import {
	loadCollection,
	parseJsonObject,
	promptVersion,
	RESPAN_API_BASE_URL,
} from './GenericFunctions';

export class KeywordsAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Respan',
		name: 'keywordsAi',
		icon: {
			light: 'file:../../icons/keywordsai.svg',
			dark: 'file:../../icons/keywordsai.dark.svg',
		},
		group: ['transform'],
		version: 1,
		description: 'Respan API integration',
		subtitle: '={{$parameter["resource"] === "gatewayPrompt" ? "Managed Prompt" : "Gateway"}}',
		defaults: {
			name: 'Respan',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'keywordsAIApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Gateway (Standard)',
						value: 'gateway',
						description: 'Make a direct LLM call with messages',
					},
					{
						name: 'Gateway with Prompt',
						value: 'gatewayPrompt',
						description: 'Use a managed prompt from Respan',
					},
				],
				default: 'gatewayPrompt',
			},

			// GATEWAY (Standard) PROPERTIES
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['gateway'],
					},
				},
				default: 'gpt-4o-mini',
				description: 'A model ID supported by your Respan Gateway provider configuration',
			},
			{
				displayName: 'System Message',
				name: 'systemMessage',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				displayOptions: {
					show: {
						resource: ['gateway'],
					},
				},
				default: 'You are a helpful assistant.',
				description: 'The system prompt to set the behavior of the AI',
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['gateway'],
					},
				},
				default: {},
				placeholder: 'Add Message',
				options: [
					{
						name: 'messageValues',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{ name: 'User', value: 'user' },
									{ name: 'Assistant', value: 'assistant' },
								],
								default: 'user',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								required: true,
								default: '',
							},
						],
					},
				],
				description: 'The conversation history (User and Assistant messages)',
			},

			// GATEWAY WITH PROMPT PROPERTIES
			{
				displayName: 'Prompt Name or ID',
				name: 'promptId',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getPrompts',
				},
				displayOptions: {
					show: {
						resource: ['gatewayPrompt'],
					},
				},
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Version Name or ID',
				name: 'version',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getVersions',
					loadOptionsDependsOn: ['promptId'],
				},
				displayOptions: {
					show: {
						resource: ['gatewayPrompt'],
					},
				},
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						resource: ['gatewayPrompt'],
					},
				},
				default: {},
				placeholder: 'Add Variable',
				options: [
					{
						name: 'variableValues',
						displayName: 'Variable',
						values: [
							{
								displayName: 'Variable Name or ID',
								name: 'name',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getVariables',
									loadOptionsDependsOn: ['promptId', 'version'],
								},
								default: '',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'The value for this variable',
							},
						],
					},
				],
				description: 'Fill in values for variables defined in your prompt',
			},

			// SHARED ADDITIONAL FIELDS
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Custom Identifier',
						name: 'customIdentifier',
						type: 'string',
						default: '',
						description: 'Custom tag to identify and filter logs faster (indexed field)',
					},
					{
						displayName: 'Customer Identifier',
						name: 'customerIdentifier',
						type: 'string',
						default: '',
						description: 'Tag to identify the user associated with this API call',
					},
					{
						displayName: 'Customer Params (JSON)',
						name: 'customerParams',
						type: 'string',
						default: '',
						description:
							'JSON object with customer parameters like name, email, budget (e.g. {"customer_identifier": "user_123", "name": "John", "email": "john@example.com"})',
					},
					{
						displayName: 'Metadata (JSON)',
						name: 'metadata',
						type: 'string',
						default: '',
						description:
							'JSON object with key-value pairs for reference (e.g. {"session_id": "123", "user_type": "premium"})',
					},
					{
						displayName: 'Model Parameters (JSON)',
						name: 'overrideParamsJson',
						type: 'string',
						default: '',
						description:
							'Model parameters such as temperature or max_tokens. For managed prompts these patch the saved configuration; messages and input must stay in the prompt template.',
					},
					{
						displayName: 'Request Breakdown',
						name: 'requestBreakdown',
						type: 'boolean',
						default: false,
						description:
							'Whether to return detailed metrics in the response (tokens, cost, latency, etc.)',
					},
				],
			},
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			async getPrompts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const prompts = await loadCollection(this, '/prompts/', 'prompts');
				return prompts.flatMap((prompt) => {
					const id = prompt.prompt_id ?? prompt.id;
					return typeof id === 'string' && id
						? [
								{
									name: typeof prompt.name === 'string' && prompt.name ? prompt.name : id,
									value: id,
								},
							]
						: [];
				});
			},

			async getVersions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const promptId = this.getCurrentNodeParameter('promptId') as string;
				if (!promptId) return [];
				const versions = await loadCollection(
					this,
					`/prompts/${encodeURIComponent(promptId)}/versions/`,
					'versions',
				);
				const options: INodePropertyOptions[] = [
					{ name: 'Deployed Version', value: '' },
					{ name: 'Latest Version (Including Draft)', value: 'latest' },
				];
				for (const version of versions) {
					const number = promptVersion(version.version);
					if (typeof number !== 'number') continue;
					const status = version.is_deployed
						? ' (Deployed)'
						: version.readonly
							? ' (Committed)'
							: ' (Draft)';
					options.push({ name: `Version ${number}${status}`, value: number });
				}
				return options;
			},

			async getVariables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const promptId = this.getCurrentNodeParameter('promptId') as string;
				if (!promptId) return [];
				let version = promptVersion(this.getCurrentNodeParameter('version'));
				const path = `/prompts/${encodeURIComponent(promptId)}/versions/`;
				if (version === undefined || version === 'latest') {
					const versions = await loadCollection(this, path, 'versions');
					if (version === 'latest') {
						const numbers = versions
							.map((entry) => promptVersion(entry.version))
							.filter((number): number is number => typeof number === 'number');
						version = numbers.length ? Math.max(...numbers) : undefined;
					} else {
						version = promptVersion(versions.find((entry) => entry.is_deployed === true)?.version);
					}
					if (typeof version !== 'number') return [];
				}
				const data = (await this.helpers.httpRequestWithAuthentication.call(this, 'keywordsAIApi', {
					method: 'GET',
					baseURL: RESPAN_API_BASE_URL,
					url: `${path}${version}/`,
					json: true,
				})) as { variables?: unknown };
				const variables = data.variables;
				if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return [];
				return Object.keys(variables).map((name) => ({ name, value: name }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
					overrideParamsJson?: string;
					stream?: boolean;
					metadata?: string;
					customIdentifier?: string;
					customerIdentifier?: string;
					customerParams?: string;
					requestBreakdown?: boolean;
				};
				const params = additionalFields.overrideParamsJson
					? parseJsonObject(this, additionalFields.overrideParamsJson, 'Model Parameters', i)
					: {};
				if (additionalFields.stream || (params.stream !== undefined && params.stream !== false)) {
					throw new NodeOperationError(
						this.getNode(),
						'Streaming is not supported by the Respan node. Remove stream or set it to false in the saved workflow and Model Parameters.',
						{ itemIndex: i },
					);
				}
				let body: IDataObject;
				if (resource === 'gateway') {
					const model = this.getNodeParameter('model', i) as string;
					const systemMessage = this.getNodeParameter('systemMessage', i, '') as string;
					const messagesData = this.getNodeParameter('messages', i, {}) as {
						messageValues?: Array<{ role: string; content: string }>;
					};
					const messages = systemMessage ? [{ role: 'system', content: systemMessage }] : [];
					for (const message of messagesData.messageValues ?? []) {
						messages.push({ role: message.role, content: message.content });
					}
					body = { model, messages, ...params, stream: false };
				} else if (resource === 'gatewayPrompt') {
					if (this.getNodeParameter('override', i, false)) {
						throw new NodeOperationError(
							this.getNode(),
							'The legacy Override Prompt Config option is unsupported. Remove override or set it to false in the saved workflow; use Model Parameters to patch the prompt configuration.',
							{ itemIndex: i },
						);
					}
					if ('messages' in params || 'input' in params) {
						throw new NodeOperationError(
							this.getNode(),
							'Managed prompt Model Parameters cannot contain messages or input. Update the prompt template and Variables instead.',
							{ itemIndex: i },
						);
					}
					const promptId = this.getNodeParameter('promptId', i) as string;
					const variablesData = this.getNodeParameter('variables', i, {}) as {
						variableValues?: Array<{ name: string; value: string }>;
					};
					let version: number | 'latest' | undefined;
					try {
						version = promptVersion(this.getNodeParameter('version', i, ''));
					} catch (error) {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
					const entries = variablesData.variableValues ?? [];
					if (entries.some((variable) => !variable.name.trim())) {
						throw new NodeOperationError(this.getNode(), 'Each prompt variable must have a name', {
							itemIndex: i,
						});
					}
					if (new Set(entries.map((variable) => variable.name)).size !== entries.length) {
						throw new NodeOperationError(this.getNode(), 'Prompt variable names must be unique', {
							itemIndex: i,
						});
					}
					const prompt: IDataObject = {
						prompt_id: promptId,
						schema_version: 2,
						variables: Object.fromEntries(
							entries.map((variable) => [variable.name, variable.value]),
						),
						// The saved prompt may enable streaming, which this JSON-returning node cannot consume.
						patch: { ...params, stream: false },
					};
					if (version !== undefined) prompt.version = version;
					body = { prompt, stream: false };
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported Respan resource: ${resource}`, {
						itemIndex: i,
					});
				}

				if (additionalFields.metadata) {
					body.metadata = parseJsonObject(this, additionalFields.metadata, 'Metadata', i);
				}
				if (additionalFields.customIdentifier)
					body.custom_identifier = additionalFields.customIdentifier;
				if (additionalFields.customerIdentifier)
					body.customer_identifier = additionalFields.customerIdentifier;
				if (additionalFields.customerParams) {
					body.customer_params = parseJsonObject(
						this,
						additionalFields.customerParams,
						'Customer Params',
						i,
					);
				}
				if (additionalFields.requestBreakdown !== undefined)
					body.request_breakdown = additionalFields.requestBreakdown;

				const responseData = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'keywordsAIApi',
					{
						method: 'POST',
						baseURL: RESPAN_API_BASE_URL,
						url: '/chat/completions',
						body,
						json: true,
					},
				);
				returnData.push({
					json: responseData as INodeExecutionData['json'],
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// This is already an n8n error with its field message and item context.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [returnData];
	}
}
