import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', video: 'retain-on-failure' },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }, { name: 'compact', use: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } }],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
