import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals, ...nextTs, { files: ['src/pwa/sw-template.js'], languageOptions: { globals: { __REBOOST_VERSION__: 'readonly', __REBOOST_PRECACHE__: 'readonly', __REBOOST_PAGES__: 'readonly', __REBOOST_DYNAMIC__: 'readonly' } } }, globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts', 'public/sw.js', 'playwright-report/**', 'test-results/**'])]);
