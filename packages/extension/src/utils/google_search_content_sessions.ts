// Shared session registry for Google tools (google_search)
// Each session stores final markdown content for a single tool invocation and allows
// a webview panel to render it on demand via a command link.
import * as vscode from 'vscode'

export interface GoogleContentSession {
    uid: string
    tool: string // tool identifier (e.g. google_search)
    contentEmitter: vscode.EventEmitter<string>
    contentBuffer: string
    panel?: vscode.WebviewPanel
    dispose: () => void
}

const sessions = new Map<string, GoogleContentSession>()

export function createGoogleContentSession(uid: string, tool: string): GoogleContentSession {
    const contentEmitter = new vscode.EventEmitter<string>()
    const session: GoogleContentSession = {
        uid,
        tool,
        contentEmitter,
        contentBuffer: '',
        panel: undefined,
        dispose: () => {
            contentEmitter.dispose()
            sessions.delete(uid)
        },
    }
    sessions.set(uid, session)
    return session
}

export function getGoogleContentSession(uid: string | undefined): GoogleContentSession | undefined {
    if (!uid) return undefined
    return sessions.get(uid)
}
