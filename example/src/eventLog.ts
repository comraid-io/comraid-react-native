export type LogEntry = {
	id: string;
	at: string;
	kind: 'info' | 'event' | 'error' | 'ok';
	message: string;
};

let seq = 0;

export function makeLogEntry(
	kind: LogEntry['kind'],
	message: string,
	detail?: unknown,
): LogEntry {
	seq += 1;
	const suffix =
		detail === undefined
			? ''
			: `\n${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}`;
	return {
		id: `${Date.now()}-${seq}`,
		at: new Date().toISOString().slice(11, 19),
		kind,
		message: `${message}${suffix}`,
	};
}
