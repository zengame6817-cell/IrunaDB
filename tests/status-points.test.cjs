const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app-v3.0.55.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const keys = ['str', 'agi', 'vit', 'int', 'dex', 'crt'];

function runAllocation(code) {
  const allocation = app.slice(app.indexOf('  const STATUS_POINT_BUDGET'), app.indexOf('  function renderStatus()'));
  const status = Object.fromEntries(keys.map(key => [key, 1]));
  vm.runInNewContext(allocation + code, { assert, state: { status } });
}

test('six base stats share 1850 points above their initial values', () => {
  assert.match(html, /id="statusPointRemaining">1850 \/ 1850 pt/);
  for (const key of keys) {
    assert.match(html, new RegExp('data-status-key="' + key + '" type="number" min="1" max="1851"'));
  }

  runAllocation(`
    assert.equal(getRemainingStatusPoints(), 1850);
    for (const key of BASE_STATUS_KEYS) {
      assert.equal(clampStatusValueToBudget(key, 1850), 1850);
      assert.equal(clampStatusValueToBudget(key, 1852), 1851);
    }
    state.status.str = 1723;
    assert.equal(getRemainingStatusPoints(), 128);
    state.status.int = clampStatusValueToBudget("int", 130);
    assert.equal(state.status.int, 129);
    assert.equal(getRemainingStatusPoints(), 0);
  `);
});

test('saved status values and bonus stats use the same point accounting', () => {
  runAllocation(`
    state.status.rlb = clampStatusValueToBudget("rlb", 101);
    assert.equal(state.status.rlb, 100);
    state.status.str = clampStatusValueToBudget("str", 1851);
    assert.equal(state.status.str, 1751);
    state.status = JSON.parse(JSON.stringify(state.status));
    assert.equal(getRemainingStatusPoints(), 0);
    assert.equal(clampStatusValueToBudget("str", state.status.str), 1751);
    assert.equal(clampStatusValueToBudget("glb", 1), 0);
  `);
});
