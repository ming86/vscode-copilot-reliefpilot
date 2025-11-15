// Shared session registry for ai_fetch_url tool
import * as vscode from 'vscode';

export type AiFetchSession = {
    uid: string;
    url: string;
    topic: string;
    // Model metadata used for UI (e.g. progress panel header)
    modelId: string;
    modelMaxInputTokens: number;
    // Timing metadata for this session (wall-clock start of the tool invocation)
    startedAt: number;
    finishedAt?: number;
    leftEmitter: vscode.EventEmitter<string>; // converted markdown of fetched content
    rightTextEmitter: vscode.EventEmitter<string>; // model text stream
    rightDoneEmitter: vscode.EventEmitter<void>; // signals completion of the model text stream
    leftBuffer: string; // full latest left content
    rightTextBuffer: string; // accumulated right text
    panel?: vscode.WebviewPanel; // webview panel associated with this session (if open)
    dispose: () => void;
};

const sessions = new Map<string, AiFetchSession>();

export function createSession(
    uid: string,
    url: string,
    topic: string,
    modelId: string,
    modelMaxInputTokens: number,
): AiFetchSession {
    const leftEmitter = new vscode.EventEmitter<string>();
    const rightTextEmitter = new vscode.EventEmitter<string>();
    const rightDoneEmitter = new vscode.EventEmitter<void>();

    const session: AiFetchSession = {
        uid,
        url,
        topic,
        modelId,
        modelMaxInputTokens,
        startedAt: Date.now(),
        leftEmitter,
        rightTextEmitter,
        rightDoneEmitter,
        leftBuffer: '',
        rightTextBuffer: '',
        panel: undefined,
        dispose: () => {
            leftEmitter.dispose();
            rightTextEmitter.dispose();
            rightDoneEmitter.dispose();
            sessions.delete(uid);
        },
    };
    sessions.set(uid, session);
    return session;
}

export function getSession(uid: string | undefined): AiFetchSession | undefined {
    if (!uid) return undefined;
    return sessions.get(uid);
}
