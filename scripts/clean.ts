import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';

async function cleanExceptGitkeep(dir: string, reserve: string[] | string = ['.gitkeep']) {
    const files = await readdir(dir);
    if (reserve instanceof String) {
        reserve = [reserve as string]
    }
    for (const file of files) {
        if (reserve.includes(file)) continue;

        const fullPath = join(dir, file);
        const fileStat = await stat(fullPath);
        if (fileStat.isFile()) {
            await unlink(fullPath);
        }
    }
}

cleanExceptGitkeep("packages/client/src", "index.ts")
cleanExceptGitkeep("packages/client/tests", ["mock.ts", "setup.ts"])
cleanExceptGitkeep("packages/types/src", "index.ts")