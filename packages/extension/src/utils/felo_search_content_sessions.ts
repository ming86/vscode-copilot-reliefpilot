// Shared session registry for Felo tool (felo_search)
import * as vscode from 'vscode'

export interface FeloContentSession {
    uid: string
    tool: string // tool identifier (e.g. felo_search)
    contentEmitter: vscode.EventEmitter<string>
    contentBuffer: string
    panel?: vscode.WebviewPanel
    dispose: () => void
}

const sessions = new Map<string, FeloContentSession>()

export function createFeloContentSession(uid: string, tool: string): FeloContentSession {
    const contentEmitter = new vscode.EventEmitter<string>()
    const session: FeloContentSession = {
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

export function getFeloContentSession(uid: string | undefined): FeloContentSession | undefined {
    if (!uid) return undefined
    return sessions.get(uid)
}
