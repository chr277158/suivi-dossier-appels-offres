import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

const port = Number(process.env.PORT || 3001);
void import('./app')
	.then(({ createApp }) => createApp().listen(port, () => console.log(`API listening on port ${port}`)))
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'API startup failed');
		process.exitCode = 1;
	});
