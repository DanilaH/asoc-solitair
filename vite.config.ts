import { defineConfig, loadEnv } from 'vite';
import profile from './src/config/c8-release.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (env.VITE_ASOC_CAMPAIGN_PLAYTEST) {
    if (env.VITE_ASOC_PROFILE !== profile.id || !['azur21-v1','hybrid21-v1'].includes(env.VITE_ASOC_CAMPAIGN_PLAYTEST))
      throw Error('Unknown or unscoped campaign playtest');
    if (Object.keys(env).some(key=>/^VITE_ASOC_ARCHIVE_|VITE_HITAPPS_FIXTURES/.test(key) && env[key] && env[key]!=='0'))
      throw Error('Campaign playtest cannot use an archived or fixture profile');
  }
  if (env.VITE_ASOC_PLAYTEST_RESERVE && (!env.VITE_ASOC_CAMPAIGN_PLAYTEST || !['15','25'].includes(env.VITE_ASOC_PLAYTEST_RESERVE)))
    throw Error('Unknown or unscoped certified reserve');
  if (env.VITE_ASOC_PROFILE) {
    if (env.VITE_ASOC_PROFILE !== profile.id) throw Error('Unknown product profile');
    const legacy = Object.keys(env).filter(key => /^VITE_(CONTENT8_|C8_OWNER_|AZUR_)/.test(key) && env[key] && env[key] !== '0');
    if (legacy.length) throw Error(`Product profile cannot be combined with QA flags: ${legacy.join(', ')}`);
  }
  return {
    plugins: env.VITE_ASOC_PROFILE ? [{
      name: 'c8-startup-shell',
      transformIndexHtml: {
        order: 'pre',
        handler: html => html.replace('<html lang="ru">', '<html lang="ru" data-c8-loading>')
          .replace('src="/src/main.ts"', 'src="/src/boot.ts"'),
      },
    }] : [],
    base: './', resolve: { dedupe: ['phaser'] },
    build: { target: 'es2022', chunkSizeWarningLimit: 1800 },
  };
});
