// Holds shared extension environment info (id, URIs) initialized on activate.
// This avoids hardcoding extension identifiers and repeated lookups.
// Code comments in English only.
import * as vscode from 'vscode';

export const env = {
    extensionUri: vscode.Uri.file(''),
    extensionId: '',
};

export function initEnv(context: vscode.ExtensionContext) {
    env.extensionUri = context.extensionUri;
    env.extensionId = context.extension.id;
}
