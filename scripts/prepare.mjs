import { existsSync } from 'node:fs';

if (process.env.NODE_ENV === 'production' || !existsSync('.git') || !existsSync('node_modules/husky')) {
  process.exit(0);
}

const { default: install } = await import('husky');
const result = install();
if (result) console.log(result);