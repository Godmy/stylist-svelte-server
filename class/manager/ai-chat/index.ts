import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// SSR-only: dev-стенд stylist-svelte бьёт в Ollama напрямую,
// т.к. gateway-local не проброшен на хост (только gateway-whisper и ollama проброшены).
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b';
const OLLAMA_URLS = [
	process.env.OLLAMA_URL,
	'http://ollama:11434',
	'http://localhost:11434'
].filter((url): url is string => Boolean(url));

export class AiChatManager {
	static postChatResponse: RequestHandler = async ({ request }) => {
		const { text, systemMessage, context } = await request.json();

		if (typeof text !== 'string' || !text.trim()) {
			throw error(400, 'Missing text');
		}

		const messages = [
			{ role: 'system', content: systemMessage || 'You are a helpful assistant.' },
			...(typeof context === 'string' && context.trim()
				? [{ role: 'system', content: `Context:\n${context}` }]
				: []),
			{ role: 'user', content: text }
		];

		let lastError: unknown;
		for (const baseUrl of OLLAMA_URLS) {
			try {
				const response = await fetch(`${baseUrl}/api/chat`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: OLLAMA_MODEL,
						stream: false,
						messages
					})
				});

				const payload = await response.json();
				if (!response.ok) {
					throw new Error(payload.error ?? 'Ollama request failed');
				}

				return json({
					reply: payload.message?.content ?? '',
					model: payload.model ?? OLLAMA_MODEL
				});
			} catch (err) {
				lastError = err;
			}
		}

		throw error(502, lastError instanceof Error ? lastError.message : 'Ollama request failed');
	};
}
