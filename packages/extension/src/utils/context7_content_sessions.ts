// Shared session registry for Context7 tools (resolve-library-id, get-library-docs)
// Each session stores final markdown content for a single tool invocation and allows
// a webview panel to render it on demand via a command link.
import * as vscode from 'vscode'

export interface Context7ContentSession {
  uid: string
  tool: string // tool identifier (e.g. context7_resolve-library-id)
  contentEmitter: vscode.EventEmitter<string>
  contentBuffer: string
  panel?: vscode.WebviewPanel
  dispose: () => void
}

const sessions = new Map<string, Context7ContentSession>()

export function createContext7ContentSession(uid: string, tool: string): Context7ContentSession {
  const contentEmitter = new vscode.EventEmitter<string>()
  const session: Context7ContentSession = {
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

export function getContext7ContentSession(uid: string | undefined): Context7ContentSession | undefined {
  if (!uid) return undefined
  return sessions.get(uid)
}
