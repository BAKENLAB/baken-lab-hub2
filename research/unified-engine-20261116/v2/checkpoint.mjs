import {existsSync} from 'node:fs';
export function assertFresh(paths){if(paths.some(p=>existsSync(p)))throw Error('V2_CHECKPOINT_EXISTS_USE_NEW_OUTPUT_DIR');}
