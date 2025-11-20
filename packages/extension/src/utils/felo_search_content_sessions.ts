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

type StoredFeloContentSession = {
    uid: string
    tool: string
    contentBuffer: string
}

const STORAGE_KEY = 'reliefpilot.feloSessions'

function getMaxEntries(): number {
    const cfg = vscode.workspace.getConfiguration('reliefpilot')
    const n = cfg.get<number>('feloHistoryMaxEntries', 20)
    if (!Number.isFinite(n) || n <= 0) return 20
    return Math.max(1, Math.floor(n))
}

class FeloSessionManager {
    private sessions: FeloContentSession[] = []
    private storage?: vscode.Memento

    initStorage(memento: vscode.Memento) {
        this.storage = memento
        this.loadFromStorage()
    }

    private loadFromStorage() {
        if (!this.storage) return
        const data = this.storage.get<StoredFeloContentSession[]>(STORAGE_KEY, []) || []
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

    private serialize(): StoredFeloContentSession[] {
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

    createSession(uid: string, tool: string): FeloContentSession {
        const contentEmitter = new vscode.EventEmitter<string>()
        const session: FeloContentSession = {
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

    getSession(uid: string | undefined): FeloContentSession | undefined {
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

const manager = new FeloSessionManager()

export function initFeloSessionStorage(context: vscode.ExtensionContext) {
    manager.initStorage(context.workspaceState)
}

export function createFeloContentSession(uid: string, tool: string): FeloContentSession {
    return manager.createSession(uid, tool)
}

export function getFeloContentSession(uid: string | undefined): FeloContentSession | undefined {
    return manager.getSession(uid)
}

export function finalizeFeloSession(uid: string) {
    manager.finalizeSession(uid)
}

export function registerFeloSessionConfigWatcher(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('reliefpilot.feloHistoryMaxEntries')) {
                manager.applyLimitFromSettings()
            }
        })
    )
}
