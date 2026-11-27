import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const profile = await json('src/config/c8-release.json');
if (!process.env.VITE_ASOC_PROFILE) process.exit(0);
if (process.env.VITE_ASOC_PROFILE !== profile.id) throw Error('Unknown product profile');

const sdkMode = process.env.ASOC_AD_MODE ?? 'disabled';
const apkVariant = process.env.ASOC_APK_VARIANT ?? 'web';
if (!['disabled', 'test', 'live'].includes(sdkMode)) throw Error('Invalid advertisement SDK mode');
if (!['debug', 'release', 'web'].includes(apkVariant)) throw Error('Invalid APK variant');
const fixtureNavigation = process.env.VITE_HITAPPS_FIXTURES === '1';
const archivedCampaign = process.env.VITE_ASOC_ARCHIVE_227 === '1';
const archivedEconomy = archivedCampaign || process.env.VITE_ASOC_ARCHIVE_229 === '1';
if ((fixtureNavigation || archivedCampaign || archivedEconomy) && (apkVariant !== 'web' || sdkMode !== 'disabled')) throw Error('Fixtures are limited to offline browser QA');

const dist = fileURLToPath(new URL('dist/', root));
const manifestName = 'release-manifest.json';
const paths = (await readdir(dist, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => relative(dist, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .filter(path => path !== manifestName)
  .sort();
const files = Object.fromEntries(await Promise.all(paths.map(async path => {
  const content = await readFile(join(dist, path));
  return [path, createHash('sha256').update(content).digest('hex')];
})));

const pkg = await json('package.json');
const lock = await json('package-lock.json');
const runtimePin = pkg.dependencies['@danilah/mini-games-kit'].split('#').at(-1);
if (!/^[0-9a-f]{40}$/.test(runtimePin) || !lock.packages['node_modules/@danilah/mini-games-kit'].resolved.endsWith('#' + runtimePin)) {
  throw Error('Expected an identical runtime pin in package.json and the lockfile');
}
const gradle = await readFile(new URL('native/android/app/build.gradle', root), 'utf8');
const [, appId] = gradle.match(/applicationId "([\w.]+)"/);
const [, suffix] = gradle.match(/applicationIdSuffix '([.\w]+)'/);
const [, versionCode] = gradle.match(/versionCode (\d+)/);
const [, androidVersion] = gradle.match(/versionName "([^"]+)"/);
if (pkg.version !== androidVersion) throw Error('Web/Android version mismatch');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const manifest = {
  version: 1, commit, gameVersion: pkg.version, androidVersionCode: Number(versionCode),
  ...profile, runtimePin, sdkMode, apkVariant,
  fixtureNavigation, archivedCampaign, archivedEconomy,
  balanceVersion: archivedEconomy ? 3 : profile.balanceVersion,
  sdkCapabilities: {
    campaignPause: sdkMode === 'test' || (sdkMode === 'live' && process.env.ASOC_OWNER_ADS_READY === '1'),
    lifeRefill: sdkMode === 'test' || (sdkMode === 'live' && process.env.ASOC_OWNER_LIVES_ADS_READY === '1'),
    rewardedOffers: sdkMode === 'test' || (sdkMode === 'live' && process.env.ASOC_REWARD_OFFERS_ADS_READY === '1'),
    impressionRevenue: sdkMode === 'live' && process.env.ASOC_OWNER_ADS_READY === '1',
  },
  packageId: apkVariant === 'debug' ? appId + suffix : appId,
  webPayload: {
    algorithm: 'sha256 of sorted path, NUL, file sha256, newline',
    sha256: createHash('sha256').update(Object.entries(files).map(([path, sha]) => `${path}\0${sha}\n`).join('')).digest('hex'),
    files,
  },
};
await writeFile(join(dist, manifestName), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Release ${profile.id} ${commit} ${sdkMode}/${apkVariant} ${manifest.webPayload.sha256}`);
