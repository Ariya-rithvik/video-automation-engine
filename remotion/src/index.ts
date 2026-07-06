// Remotion entry point. Registers compositions defined in Root.tsx so the CLI/renderer can find them.

import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
