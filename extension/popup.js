import { validEndpoint } from './privacy.mjs';
const $ = id => document.getElementById(id);
async function refresh() {
    const s = await chrome.runtime.sendMessage({ type: 'STATUS' });
    $('status').textContent = s.status + ' · ' + s.buffered + ' buffered';
    $('extension-id').textContent = s.extensionId;
    $('enabled').checked = s.enabled;
    $('endpoint').value = s.endpoint;
    $('events').replaceChildren(...s.recent.slice().reverse().map(e => {
        const li = document.createElement('li');
        li.textContent = e.sourceApplication + ' · ' + e.action.replaceAll('_', ' ');
        return li;
    }));
}
$('setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const endpoint = $('endpoint').value.trim().replace(/\/$/, '');
    if (!validEndpoint(endpoint)) {
        $('status').textContent = 'Use an HTTPS origin or localhost, with no path or query.';
        return;
    }
    if (endpoint.startsWith('https:') && !await chrome.permissions.request({ origins: [endpoint + '/*'] })) {
        $('status').textContent = 'Permission to deliver to this origin was not granted.';
        return;
    }
    const r = await chrome.runtime.sendMessage({ type: 'SETUP', endpoint, token: $('token').value, enabled: $('enabled').checked });
    $('token').value = '';
    if (r.error)
        $('status').textContent = r.error;
    else
        await refresh();
});
for (const [id, type] of [['finish', 'FINISH'], ['retry', 'FLUSH'], ['clear', 'CLEAR']])
    $(id).addEventListener('click', async () => {
        const result = await chrome.runtime.sendMessage({ type });
        if (result.error)
            $('status').textContent = result.error;
        else
            await refresh();
    });
void refresh();
