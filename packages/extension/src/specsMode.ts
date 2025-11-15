import * as path from 'path';
import * as vscode from 'vscode';

const SPEC_CHATMODE_FILENAME = 'Spec.chatmode.md';
const SPEC_AGENT_FILENAME = 'Spec.agent.md';

type SemverTriplet = {
  major: number;
  minor: number;
  patch: number;
};

const MIN_AGENT_SPEC_VERSION: SemverTriplet = {
  major: 1,
  minor: 106,
  patch: 0,
};

function parseVersionStrict(version: string): SemverTriplet {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid VS Code version string: "${version}"`);
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function isAtLeast(version: SemverTriplet, minimum: SemverTriplet): boolean {
  if (version.major !== minimum.major) {
    return version.major > minimum.major;
  }

  if (version.minor !== minimum.minor) {
    return version.minor > minimum.minor;
  }

  return version.patch >= minimum.patch;
}

export function getSpecFilenameForVersion(version: string): string {
  const current = parseVersionStrict(version);
  return isAtLeast(current, MIN_AGENT_SPEC_VERSION) ? SPEC_AGENT_FILENAME : SPEC_CHATMODE_FILENAME;
}

export const CREATE_SPECS_MODE_COMMAND = 'reliefpilot.createSpecsMode';

export function registerSpecsModeCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    CREATE_SPECS_MODE_COMMAND,
    () => createSpecsMode(context),
  );
  context.subscriptions.push(disposable);
}

function getPromptsDirectoryUri(context: vscode.ExtensionContext): vscode.Uri {
  const globalStorageDir = path.dirname(context.globalStorageUri.fsPath);
  const userRoot = path.dirname(globalStorageDir);
  const promptsPath = path.join(userRoot, 'prompts');
  return vscode.Uri.file(promptsPath);
}

async function createSpecsMode(context: vscode.ExtensionContext) {
  const sourceUri = vscode.Uri.joinPath(context.extensionUri, 'media', 'spec_prompt.md');
  let specContent: Uint8Array;
  try {
    specContent = await vscode.workspace.fs.readFile(sourceUri);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Failed to read bundled 'spec_prompt.md': ${message}`);
    return;
  }

  try {
    const original = Buffer.from(specContent).toString('utf8');
    if (original.includes('tools: []') && vscode.lm) {
      const all = vscode.lm.tools;
      const names = all.map(t => t.name);
      const uniqueSorted = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
      const formatted = ['tools: [']
        .concat(
          uniqueSorted.map((n, i) => `  ${JSON.stringify(n)}${i < uniqueSorted.length - 1 ? ',' : ''}`),
        )
        .concat(']')
        .join('\n');

      const updated = original.replace('tools: []', formatted);
      specContent = Buffer.from(updated, 'utf8');
    }
  } catch (err) {
    // If anything goes wrong during replacement, fall back to original content silently.
    // We intentionally do not block file creation here.
  }

  const promptsDirUri = getPromptsDirectoryUri(context);
  let targetFilename: string;
  try {
    targetFilename = getSpecFilenameForVersion(vscode.version);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Failed to determine specs filename: ${message}`);
    return;
  }

  const targetUri = vscode.Uri.joinPath(promptsDirUri, targetFilename);

  try {
    await vscode.workspace.fs.createDirectory(promptsDirUri);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Unable to create prompts directory: ${message}`);
    return;
  }

  let targetExists = false;
  try {
    await vscode.workspace.fs.stat(targetUri);
    targetExists = true;
  } catch (err) {
    if (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') {
      targetExists = false;
    } else if (err instanceof Error) {
      void vscode.window.showErrorMessage(`Unable to access ${targetFilename}: ${err.message}`);
      return;
    } else {
      void vscode.window.showErrorMessage(`Unable to access ${targetFilename} due to an unknown error.`);
      return;
    }
  }

  if (targetExists) {
    const replace = 'Replace';
    const choice = await vscode.window.showWarningMessage(
      `${targetFilename} already exists in your prompts folder. Do you want to replace it?`,
      { modal: true },
      replace,
    );
    if (choice !== replace) {
      return;
    }
  }

  try {
    await vscode.workspace.fs.writeFile(targetUri, specContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Failed to write ${targetFilename}: ${message}`);
    return;
  }

  try {
    await vscode.window.showTextDocument(targetUri);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Spec mode created, but opening the file failed: ${message}`);
  }
}
