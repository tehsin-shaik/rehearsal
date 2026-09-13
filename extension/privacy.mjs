const allowed = new Set(['reportId', 'subject', 'sender', 'issueId', 'category', 'department', 'owner', 'channel', 'severity', 'labels', 'url', 'finished']);
const sensitive = /\b(?:password|token|secret|api.?key|OTP|PIN)\s*[:=]|\b(?:\d[ -]*?){13,19}\b|-----BEGIN|\bBearer\s/i;
export function sanitize(payload) { const clean = {}; for (const [key, value] of Object.entries(payload ?? {})) {
    if (!allowed.has(key))
        continue;
    if (key === 'finished' && typeof value === 'boolean') {
        clean[key] = value;
        continue;
    }
    if (key === 'url') {
        try {
            const u = new URL(value);
            if (u.protocol === 'https:')
                clean.url = u.origin + u.pathname;
        }
        catch { }
        continue;
    }
    if (typeof value === 'string' && !sensitive.test(value))
        clean[key] = value.trim().slice(0, key === 'subject' ? 500 : 200);
    if (key === 'labels' && Array.isArray(value))
        clean.labels = value.filter(v => typeof v === 'string' && !sensitive.test(v)).slice(0, 10).map(v => v.slice(0, 50));
} return clean; }
export function validEndpoint(value) { try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
}
catch {
    return false;
} }
