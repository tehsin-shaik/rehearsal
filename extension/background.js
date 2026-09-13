import { sanitize, validEndpoint } from './privacy.mjs';
let flushing = false;
let commandQueue = Promise.resolve();
async function state() {
    return { enabled: false, endpoint: 'http://localhost:3000', traceId: 'trace-' + crypto.randomUUID(), queue: [], recent: [], status: 'Not paired', ...await chrome.storage.session.get(null) };
}
async function flush() {
    if (flushing)
        return;
    flushing = true;
    try {
        const s = await state();
        if (!s.token || !s.queue.length)
            return;
        const batch = s.queue.slice(0, 50);
        const response = await fetch(s.endpoint + '/api/observe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Rehearsal-Observer': s.token }, body: JSON.stringify({ events: batch }), signal: AbortSignal.timeout(6000) });
        if (!response.ok)
            throw new Error('Delivery returned HTTP ' + response.status);
        const latest = await state();
        const sent = new Set(batch.map(e => JSON.stringify(e)));
        await chrome.storage.session.set({ queue: latest.queue.filter(e => !sent.has(JSON.stringify(e))), status: 'Delivered · ' + new Date().toLocaleTimeString() });
    }
    catch {
        await chrome.storage.session.set({ status: 'Delivery paused. Sanitized events are buffered; check pairing and server.' });
    }
    finally {
        flushing = false;
    }
}
chrome.alarms.create('deliver', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {
    void flush();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    commandQueue = commandQueue.then(async () => {
        const s = await state();
        if (message.type === 'STATUS')
            return { ...s, token: undefined, queue: undefined, buffered: s.queue.length, extensionId: chrome.runtime.id };
        if (message.type === 'SETUP') {
            if (sender.tab)
                throw new Error('Settings are popup-only');
            if (!validEndpoint(message.endpoint))
                throw new Error('Use an HTTPS origin or localhost origin without a path.');
            await chrome.storage.session.set({ endpoint: message.endpoint.replace(/\/$/, ''), token: String(message.token ?? '').trim() || s.token, enabled: !!message.enabled, traceId: s.traceId });
            await flush();
            return { ok: true };
        }
        if (message.type === 'EVENT') {
            if (!s.enabled || !sender.tab)
                return { ignored: true };
            const allowedOrigins = [/^https:\/\/mail\.google\.com\//, /^https:\/\/[^/]+\.atlassian\.net\//, /^https:\/\/app\.clickup\.com\//, /^https:\/\/app\.slack\.com\//];
            if (!allowedOrigins.some(re => re.test(sender.tab.url ?? '')))
                return { ignored: true };
            const event = { traceId: s.traceId, occurredAt: new Date().toISOString(), sourceApplication: message.sourceApplication, action: message.action, payload: sanitize(message.payload) };
            const queue = [...s.queue, event];
            await chrome.storage.session.set({ queue: queue.slice(-500), recent: [...s.recent, event].slice(-12), traceId: s.traceId, status: queue.length > 500 ? 'Buffer full: oldest metadata was dropped.' : 'Queued' });
            await flush();
            return { ok: true };
        }
        if (message.type === 'FINISH') {
            if (sender.tab)
                throw new Error('Finish is popup-only');
            const event = { traceId: s.traceId, occurredAt: new Date().toISOString(), sourceApplication: 'system', action: 'classify_report', payload: { finished: true } };
            await chrome.storage.session.set({ queue: [...s.queue, event].slice(-500), traceId: 'trace-' + crypto.randomUUID() });
            await flush();
            return { ok: true };
        }
        if (message.type === 'FLUSH') {
            await flush();
            return { ok: true };
        }
        if (message.type === 'CLEAR') {
            if (sender.tab)
                throw new Error('Clear is popup-only');
            await chrome.storage.session.set({ queue: [], recent: [], enabled: false, token: '', status: 'Cleared and unpaired' });
            return { ok: true };
        }
        throw new Error('Unknown command');
    }).then(respond).catch(error => respond({ error: error.message }));
    return true;
});
