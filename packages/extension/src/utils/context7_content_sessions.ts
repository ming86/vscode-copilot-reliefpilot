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

type StoredContext7ContentSession = {
  uid: string
  tool: string
  contentBuffer: string
}

const STORAGE_KEY = 'reliefpilot.context7Sessions'

function getMaxEntries(): number {
  const cfg = vscode.workspace.getConfiguration('reliefpilot')
  const n = cfg.get<number>('context7HistoryMaxEntries', 20)
  if (!Number.isFinite(n) || n <= 0) return 20
  return Math.max(1, Math.floor(n))
}

class Context7SessionManager {
  private sessions: Context7ContentSession[] = []
  private storage?: vscode.Memento

  initStorage(memento: vscode.Memento) {
    this.storage = memento
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (!this.storage) return
    const data = this.storage.get<StoredContext7ContentSession[]>(STORAGE_KEY, []) || []
    if (Array.isArray(data)) {
      this.sessions = data.map(s => {
        const contentEmitter = new vscode.EventEmitter<string>()
        return {
          ...s,
          contentEmitter,
          panel: undefined,
          dispose: () => { contentEmitter.dispose() }
          // No panel to dispose here as it's undefined on load
        }
      })
      const max = getMaxEntries()
      if (this.sessions.length > max) {
        const removed = this.sessions.splice(max)
        removed.forEach(s => s.dispose())
        void this.saveToStorage()
      }
    }
  }

  private serialize(): StoredContext7ContentSession[] {
    return this.sessions.map(s => ({
      uid: s.uid,
      tool: s.tool,
      contentBuffer: s.contentBuffer
    }))
  }

  private async saveToStorage() {
    if (!this.storage) return
    try { await this.storage.update(STORAGE_KEY, this.serialize()) } catch { }
  }

  createSession(uid: string, tool: string): Context7ContentSession {
    const contentEmitter = new vscode.EventEmitter<string>()
    const session: Context7ContentSession = {
      uid,
      tool,
      contentEmitter,
      contentBuffer: '',
      panel: undefined,
      dispose: () => {
        contentEmitter.dispose()
      },
    }
    session.dispose = () => {
      contentEmitter.dispose()
      session.panel?.dispose()
    }
    this.sessions.unshift(session)
    const max = getMaxEntries()
    if (this.sessions.length > max) {
      const removed = this.sessions.splice(max)
      removed.forEach(s => s.dispose())
    }
    void this.saveToStorage()
    return session
  }

  getSession(uid: string | undefined): Context7ContentSession | undefined {
    if (!uid) return undefined
    return this.sessions.find(s => s.uid === uid)
  }

  finalizeSession(uid: string) {
    const session = this.sessions.find(s => s.uid === uid)
    if (session) {
      void this.saveToStorage()
      session.dispose()
    }
  }

  applyLimitFromSettings() {
    const max = getMaxEntries()
    if (this.sessions.length > max) {
      const removed = this.sessions.splice(max)
      removed.forEach(s => { try { s.dispose() } catch { } })
      void this.saveToStorage()
    }
  }
}

const manager = new Context7SessionManager()

export function initContext7SessionStorage(context: vscode.ExtensionContext) {
  manager.initStorage(context.workspaceState)
}

export function createContext7ContentSession(uid: string, tool: string): Context7ContentSession {
  return manager.createSession(uid, tool)
}

export function getContext7ContentSession(uid: string | undefined): Context7ContentSession | undefined {
  return manager.getSession(uid)
}

export function finalizeContext7Session(uid: string) {
  manager.finalizeSession(uid)
}

export function registerContext7SessionConfigWatcher(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('reliefpilot.context7HistoryMaxEntries')) {
        manager.applyLimitFromSettings()
      }
    })
  )
}
