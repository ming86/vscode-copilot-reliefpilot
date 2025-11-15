// Shared session registry for GitHub tools (search-repositories, get-file-contents)
// Each session stores final markdown content for a single tool invocation and allows
// a webview panel to render it on demand via a command link.
import * as vscode from 'vscode'

export interface GithubContentSession {
    uid: string
    tool: string // tool identifier (e.g. github_search_repositories)
    contentEmitter: vscode.EventEmitter<string>
    contentBuffer: string
    panel?: vscode.WebviewPanel
    dispose: () => void
}

const sessions = new Map<string, GithubContentSession>()

export function createGithubContentSession(uid: string, tool: string): GithubContentSession {
    const contentEmitter = new vscode.EventEmitter<string>()
    const session: GithubContentSession = {
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

export function getGithubContentSession(uid: string | undefined): GithubContentSession | undefined {
    if (!uid) return undefined
    return sessions.get(uid)
}
