import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
let chromium;
try {
    ({ chromium } = await import('playwright'));
}
catch {
    if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)
        throw new Error('Install Playwright to run browser checks: npm install --no-save --package-lock=false playwright');
    ({ chromium } = await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright/index.mjs'));
}
const base = process.env.REHEARSAL_TEST_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], external = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== new URL(base).origin) {
    external.push(url.origin);
    return route.abort();
} return route.continue(); });
await mkdir('test-results', { recursive: true });
try {
    await page.goto(base + '/workspace');
    await page.getByRole('button', { name: 'Start first observation', exact: true }).waitFor();
    await page.screenshot({ path: 'test-results/workspace.png', fullPage: true });
    const steps = ['Read report', 'Inspect details', 'Draft issue', 'Apply labels & priority', 'Assign owner', 'Create issue', 'Open team channel', 'Draft notification', 'Send notification', 'Draft customer reply', 'Send customer reply'];
    for (const start of ['Start first observation', 'Teach second example']) {
        await page.getByRole('button', { name: start, exact: true }).click();
        for (const step of steps)
            await page.getByRole('button', { name: step, exact: true }).first().click();
    }
    await page.getByRole('button', { name: 'Activate learned workflow', exact: true }).click();
    await page.getByRole('button', { name: 'Deliver new report', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect Ghost Run', exact: true }).click();
    await page.getByRole('dialog', { name: 'Ghost Run', exact: true }).waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /Awaiz/);
    assert.match(await page.getByRole('dialog').innerText(), /Umar/);
    await page.screenshot({ path: 'test-results/ghost-run.png', fullPage: true });
    await page.getByRole('button', { name: 'Approve & execute', exact: true }).click();
    await page.getByText('All 5 actions verified', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('button', { name: 'Try an ambiguous report', exact: true }).click();
    await page.getByRole('button', { name: 'Resolve & review', exact: true }).click();
    await page.getByText('This report needs your judgment.', { exact: true }).last().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Approve & execute', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('link', { name: /^Workflows/ }).first().click();
    await page.getByText('Customer support triage', { exact: true }).waitFor();
    for (const route of ['/', '/onboarding', '/workspace', '/workflows', '/workflows/support-triage', '/activity', '/privacy', '/integrations']) {
        const response = await page.goto(base + route);
        assert.equal(response.status(), 200, route);
        await page.locator('h1').waitFor();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/workspace');
    await page.getByRole('button', { name: 'Start first observation', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page should not overflow horizontally');
    await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('BROWSER_CHECKS_PASSED: manual learning, adaptation, approval, review, routes, mobile, zero external requests.');
    if (process.env.REHEARSAL_PRINT_SCREENSHOT === 'true') {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(base + '/workspace');
        await page.getByRole('button', { name: 'Start first observation', exact: true }).waitFor();
        console.log('REHEARSAL_SCREENSHOT_BASE64=' + Buffer.from(await page.screenshot({ type: 'jpeg', quality: 65 })).toString('base64'));
    }
}
catch (error) {
    await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
    throw error;
}
finally {
    await browser.close();
}
