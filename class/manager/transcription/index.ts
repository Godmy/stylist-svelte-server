import { json, type RequestEvent } from '@sveltejs/kit';

export class TranscriptionManager {
	static async postTranscriptionResponse(event: RequestEvent): Promise<Response> {
		const form = await event.request.formData();
		const file = form.get('file');

		if (!(file instanceof File)) {
			return json({ error: 'Audio file is required.' }, { status: 400 });
		}

		const body = new FormData();
		body.set('file', file);

		const language = form.get('language');
		const prompt = form.get('prompt');
		if (typeof language === 'string' && language.trim()) body.set('language', language);
		if (typeof prompt === 'string' && prompt.trim()) body.set('prompt', prompt);

		const gatewayUrls = [
			process.env.WHISPER_GATEWAY_URL ?? 'http://gateway-whisper:8010',
			'http://localhost:8010'
		].map((url) => url.replace(/\/+$/, ''));
		let response: Response | null = null;
		let gatewayError: unknown = null;

		for (const gatewayUrl of gatewayUrls) {
			try {
				response = await fetch(`${gatewayUrl}/transcribe`, {
					method: 'POST',
					body
				});
				break;
			} catch (error) {
				gatewayError = error;
			}
		}

		if (!response) {
			const message =
				gatewayError instanceof Error ? gatewayError.message : 'Whisper gateway unavailable.';
			return json({ error: message }, { status: 502 });
		}

		const payload = await response.json();

		if (!response.ok) {
			return json(
				{ error: payload.error ?? 'Whisper transcription failed.' },
				{ status: response.status }
			);
		}

		return json({
			text: payload.text ?? '',
			model: payload.model ?? 'faster-whisper',
			language: typeof language === 'string' && language.trim() ? language : undefined
		});
	}
}
