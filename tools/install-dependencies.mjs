import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const KIT_REVISION = 'a9325265e87583a4872cf6a158e1e881a0d7508e';
const kitHttps = 'https://github.com/DanilaH/mini-games-kit.git';

/** Command-local transport/auth only. Never writes a token or changes a Git revision. */
export function kitInstallEnvironment(parent, token = parent.MINI_GAMES_KIT_READ_TOKEN) {
  const env = { ...parent };
  delete env.MINI_GAMES_KIT_READ_TOKEN;
  const entries = [
    [`url.${kitHttps}.insteadOf`, 'ssh://git@github.com/DanilaH/mini-games-kit.git'],
    [`url.${kitHttps}.insteadOf`, 'git@github.com:DanilaH/mini-games-kit.git'],
  ];
  if (token) {
    if (/[\r\n]/.test(token)) throw Error('Invalid kit credential format');
    entries.push([`http.${kitHttps}.extraheader`, `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`]);
  }
  let count = Number(env.GIT_CONFIG_COUNT ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) throw Error('Invalid inherited Git configuration');
  for (const [key, value] of entries) {
    env[`GIT_CONFIG_KEY_${count}`] = key;
    env[`GIT_CONFIG_VALUE_${count++}`] = value;
  }
  env.GIT_CONFIG_COUNT = String(count);
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

export function validateKitPin(pkg, lock) {
  const expected = `git+${kitHttps}#${KIT_REVISION}`;
  if (pkg.dependencies?.['@danilah/mini-games-kit'] !== expected ||
      lock.packages?.['node_modules/@danilah/mini-games-kit']?.resolved !== expected) {
    throw Error('The exact approved kit HTTPS revision must match package.json and package-lock.json');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateKitPin(JSON.parse(readFileSync('package.json')), JSON.parse(readFileSync('package-lock.json')));
  const env = kitInstallEnvironment(process.env);
  // GitHub masks the secret itself; also mask its derived HTTP header in runner logs.
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.MINI_GAMES_KIT_READ_TOKEN) {
    console.log(`::add-mask::${env[`GIT_CONFIG_VALUE_${Number(env.GIT_CONFIG_COUNT) - 1}`]}`);
  }
  const result = spawnSync('npm', ['ci', '--no-audit', '--no-fund', ...process.argv.slice(2)], { env, stdio: 'inherit' });
  if (result.error) console.error('Could not start npm ci');
  if (result.status !== 0 && !process.env.MINI_GAMES_KIT_READ_TOKEN) {
    console.error('The pinned kit repository is private. Configure MINI_GAMES_KIT_READ_TOKEN with Contents:read for DanilaH/mini-games-kit, or use an existing authorized Git credential. Do not publish the private kit or change its revision.');
  }
  process.exitCode = result.status ?? 1;
}
