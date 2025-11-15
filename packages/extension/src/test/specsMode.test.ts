import * as assert from 'assert';

import { getSpecFilenameForVersion } from '../specsMode';

suite('getSpecFilenameForVersion', () => {
    test('returns Spec.agent.md when version equals threshold', () => {
        assert.strictEqual(getSpecFilenameForVersion('1.106.0'), 'Spec.agent.md');
    });

    test('returns Spec.agent.md when version exceeds threshold', () => {
        assert.strictEqual(getSpecFilenameForVersion('1.107.2'), 'Spec.agent.md');
    });

    test('returns Spec.agent.md for insider build with same version', () => {
        assert.strictEqual(getSpecFilenameForVersion('1.106.0-insider'), 'Spec.agent.md');
    });

    test('returns Spec.chatmode.md when version is below threshold', () => {
        assert.strictEqual(getSpecFilenameForVersion('1.105.9'), 'Spec.chatmode.md');
    });

    test('throws an error when version cannot be parsed', () => {
        assert.throws(() => getSpecFilenameForVersion('invalid'), /Invalid VS Code version string/);
    });
});
