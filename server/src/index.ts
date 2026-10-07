import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { createApp } from './app';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

const port = Number(process.env.PORT || 3001);
createApp().listen(port, () => console.log(`API listening on port ${port}`));
