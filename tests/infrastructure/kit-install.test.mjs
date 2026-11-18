import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kitInstallEnvironment, validateKitPin, KIT_REVISION } from '../../tools/install-dependencies.mjs';

test('SSH is rewritten only for the approved kit, without a persisted credential', () => {
  const parent = { PATH: '/bin', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'color.ui', GIT_CONFIG_VALUE_0: 'false' };
  const env = kitInstallEnvironment(parent);
  assert.equal(env.GIT_CONFIG_COUNT, '3');
  assert.equal(env.GIT_CONFIG_KEY_0, 'color.ui');
  assert.equal(env.GIT_CONFIG_VALUE_1, 'ssh://git@github.com/DanilaH/mini-games-kit.git');
  assert.equal(env.GIT_CONFIG_VALUE_2, 'git@github.com:DanilaH/mini-games-kit.git');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(parent.GIT_CONFIG_COUNT, '1');
  assert.ok(!Object.values(env).some(v => v.includes('Authorization')));
});
test('credential stays out of the URL and is limited to the kit HTTP path', () => {
  const env = kitInstallEnvironment({ MINI_GAMES_KIT_READ_TOKEN: 'fixture-read-only' });
  assert.equal(env.MINI_GAMES_KIT_READ_TOKEN, undefined);
  assert.equal(env.GIT_CONFIG_KEY_2, 'http.https://github.com/DanilaH/mini-games-kit.git.extraheader');
  assert.equal(env.GIT_CONFIG_VALUE_2, 'AUTHORIZATION: basic ' + Buffer.from('x-access-token:fixture-read-only').toString('base64'));
  assert.ok(!env.GIT_CONFIG_KEY_0.includes('fixture-read-only'));
  assert.throws(() => kitInstallEnvironment({}, 'invalid\ncredential'));
});
test('transport repair refuses an implicit kit upgrade or an SSH lock entry', () => {
  const pin = 'git+https://github.com/DanilaH/mini-games-kit.git#' + KIT_REVISION;
  const pkg = { dependencies: { '@danilah/mini-games-kit': pin } };
  const lock = { packages: { 'node_modules/@danilah/mini-games-kit': { resolved: pin } } };
  validateKitPin(pkg, lock);
  assert.throws(() => validateKitPin(pkg, { packages: { 'node_modules/@danilah/mini-games-kit': { resolved: pin.replace('git+https://', 'git+ssh://git@') } } }));
  assert.throws(() => validateKitPin({ dependencies: { '@danilah/mini-games-kit': pin.replace(KIT_REVISION, 'main') } }, lock));
});
