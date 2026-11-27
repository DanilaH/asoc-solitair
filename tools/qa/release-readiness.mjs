import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const secrets = [
  'ASOC_STORE_BASE64', 'ASOC_STORE_PASSWORD', 'ASOC_KEY_ALIAS', 'ASOC_KEY_PASSWORD',
  'YANDEX_BANNER_AD_UNIT_ID', 'YANDEX_INTERSTITIAL_AD_UNIT_ID', 'YANDEX_REWARDED_AD_UNIT_ID',
  'APPMETRICA_API_KEY',
];
const approvals = ['ASOC_OWNER_ADS_READY', 'ASOC_OWNER_LIVES_ADS_READY', 'ASOC_REWARD_OFFERS_ADS_READY'];
const configuration = Object.fromEntries(secrets.map(name => [name, Boolean(process.env[name]?.trim())]));
const approval = Object.fromEntries(approvals.map(name => [name, process.env[name] === '1']));
const demoIds = secrets.filter(name => name.endsWith('_AD_UNIT_ID') && process.env[name]?.startsWith('demo-'));
const ready = Object.values(configuration).every(Boolean) && Object.values(approval).every(Boolean) && demoIds.length === 0;
const report = {
  schema: 1, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  configuration, approval, demoIdsRejected: demoIds.length > 0,
  buildPrerequisites: ready ? 'READY' : 'BLOCKED_CONFIGURATION',
  physicalDemo: 'BLOCKED_DEVICE', liveSdkAndAnalyticsDelivery: 'UNVERIFIED',
  signingIdentity: 'REQUIRES_SIGNED_ARTIFACT_VERIFICATION',
};
mkdirSync('.recording', { recursive: true });
writeFileSync('.recording/release-readiness.json', JSON.stringify(report, null, 2) + '\n');
// Log only presence and approval, never provider values or signing material.
console.log(JSON.stringify(report));
if (process.argv.includes('--require') && !ready) process.exitCode = 1;
