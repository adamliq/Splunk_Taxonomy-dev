'use strict';
// Journey tracker: items added on the Onboarding flow page are saved in this browser only,
// shown as a count on their station, listed in the inspector with Advance and Edit, and
// exported to / imported from CSV (rows with an unknown route or step are skipped).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withServerAndPage } = require('../lib/browser-harness');

test('add, persist, badge, advance, edit and remove a tracked item', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.removeItem('latchJourneyTracker.v1'));
    await page.reload({ waitUntil: 'load' });
    const [first, second, third] = await page.evaluate(() => onboardingJourney.models.onboarding.items.slice(0, 3).map(i => i.id));

    assert.equal(await page.isHidden('#objTracker'), true);
    await page.click('#objTrackerBtn');
    assert.equal(await page.getAttribute('#objTrackerBtn', 'aria-expanded'), 'true');
    await page.fill('#objTrackerForm [name=name]', 'Okta <system> log');
    await page.selectOption('#objTrackerForm [name=step]', second);
    await page.fill('#objTrackerForm [name=notes]', 'owner: IAM team');
    await page.click('#objTrackerForm [type=submit]');
    assert.equal(await page.textContent('#objTrackerCount'), '1');
    assert.match(await page.textContent('#objTrackerStatus'), /Added Okta <system> log/);
    assert.match(await page.textContent('#objTrackerList'), /Okta <system> log/);
    assert.equal(await page.locator('#objTrackerList img, #objTrackerList system').count(), 0, 'name rendered as text');

    // Saved, and shown as a count on its station after a reload.
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.textContent('#objTrackerCount'), '1');
    assert.equal(await page.textContent(`#onboardingFlowMapWrap [data-item="${second}"] .obj-tracked text`), '1');
    assert.match(await page.getAttribute(`#onboardingFlowMapWrap [data-item="${second}"]`, 'aria-label'), /1 tracked$/);
    assert.equal(await page.locator(`#onboardingFlowMapWrap [data-item="${first}"] .obj-tracked`).count(), 0);

    // The badge sits after the station name, not over it.
    const box = await page.evaluate(id => {
      const g = document.querySelector(`#onboardingFlowMapWrap [data-item="${id}"]`);
      const name = [...g.querySelectorAll(':scope > text')][0].getBBox(), badge = g.querySelector('.obj-tracked rect').getBBox();
      return { nameEnd: name.x + name.width, badgeStart: badge.x };
    }, second);
    assert.ok(box.badgeStart > box.nameEnd, JSON.stringify(box));

    // The layer toggle hides the badges.
    await page.click('#onboardingJourney [data-layer="tracked"]');
    assert.equal(await page.locator('#onboardingFlowMapWrap .obj-tracked').count(), 0);
    await page.click('#onboardingJourney [data-layer="tracked"]');

    // Inspector: tracked here, then Advance moves it to the next step.
    await page.click(`#onboardingFlowMapWrap [data-item="${second}"]`);
    assert.match(await page.textContent('#objInspector'), /Tracked here \(1\)[\s\S]*Okta <system> log/);
    await page.click('#objInspector [data-track-advance]');
    assert.equal(await page.evaluate(() => journeyTracker[0].step), third);
    assert.equal(await page.locator(`#onboardingFlowMapWrap [data-item="${third}"] .obj-tracked`).count(), 1);
    assert.equal(await page.locator(`#onboardingFlowMapWrap [data-item="${second}"] .obj-tracked`).count(), 0);

    // Edit from the list fills the form; saving changes the state.
    assert.equal(await page.isHidden('#objTracker'), true, 'panel starts closed after a reload');
    await page.click('#objTrackerBtn');
    await page.click('#objTrackerList [data-track-edit]');
    assert.equal(await page.inputValue('#objTrackerForm [name=name]'), 'Okta <system> log');
    assert.equal(await page.textContent('#objTrackerForm [type=submit]'), 'Save changes');
    await page.selectOption('#objTrackerForm [name=state]', 'EXCEPTION');
    await page.click('#objTrackerForm [type=submit]');
    assert.equal(await page.evaluate(() => journeyTracker[0].state), 'EXCEPTION');
    assert.equal(await page.textContent('#objTrackerCount'), '1');

    await page.click('#objTrackerList [data-track-remove]');
    assert.equal(await page.textContent('#objTrackerCount'), '0');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('latchJourneyTracker.v1')).length), 0);
    assert.deepEqual(pageErrors, []);
  });
});

test('CSV export quotes and neutralises formulas; import skips unknown steps', async () => {
  await withServerAndPage(async ({ page, baseUrl, pageErrors }) => {
    await page.goto(`${baseUrl}/index.html#onboarding-flow`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.removeItem('latchJourneyTracker.v1'));
    await page.reload({ waitUntil: 'load' });
    const step = await page.evaluate(() => onboardingJourney.models.detection.items[1].id);
    const csv = [
      'name,route,step,state,notes',
      `"Brute force, admin",detection,${step},testing,"says ""hi"""`,
      `"=HYPERLINK(""x"")",detection,${step},,`,
      'Ghost,detection,no-such-step,PRODUCTION,',
      `Typo route,detect,${step},,`,
    ].join('\n');
    await page.click('#objTrackerBtn');
    await page.setInputFiles('#objTrackerImport', { name: 'tracker.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForFunction(() => /Imported/.test(document.getElementById('objTrackerStatus').textContent));
    assert.equal(await page.textContent('#objTrackerStatus'), 'Imported 2 items; skipped 2 rows with an unknown route or step.');
    const items = await page.evaluate(() => journeyTracker.map(t => [t.name, t.route, t.state, t.notes]));
    assert.deepEqual(items[0], ['Brute force, admin', 'detection', 'TESTING', 'says "hi"']);
    assert.equal(items[1][0], '=HYPERLINK("x")');
    assert.ok(items[1][2], 'state defaults from the step');

    const out = await page.evaluate(() => journeyTrackerCsv());
    const lines = out.split('\n');
    assert.equal(lines[0], 'name,route,step,step_name,state,notes,updated');
    assert.match(lines[1], /^"Brute force, admin",detection,/);
    assert.match(lines[1], /,"says ""hi""",/);
    assert.match(lines[2], /^"'=HYPERLINK\(""x""\)",detection,/);

    // Round trip: re-importing the export gives the same names (the formula guard is removed).
    await page.evaluate(text => { journeyTracker = []; journeyTrackerImport(text); }, out);
    assert.deepEqual(await page.evaluate(() => journeyTracker.map(t => t.name)), ['Brute force, admin', '=HYPERLINK("x")']);
    assert.deepEqual(pageErrors, []);
  });
});
