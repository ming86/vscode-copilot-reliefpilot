// Context7 authorization utilities
// Stores context reference and provides token read/write/delete operations
import * as vscode from 'vscode'

const CONTEXT7_TOKEN_SECRET_KEY = 'reliefpilot.context7.apiToken'

let extensionContext: vscode.ExtensionContext | undefined

export function initContext7Auth(context: vscode.ExtensionContext): void {
    extensionContext = context
}

async function getToken(): Promise<string | undefined> {
    if (!extensionContext) return undefined
    const token = await extensionContext.secrets.get(CONTEXT7_TOKEN_SECRET_KEY)
    return token && token.trim().length > 0 ? token.trim() : undefined
}

async function deleteToken(): Promise<void> {
    if (!extensionContext) return
    await extensionContext.secrets.delete(CONTEXT7_TOKEN_SECRET_KEY)
}

async function updateToken(): Promise<string | undefined> {
    const token = await vscode.window.showInputBox({
        title: 'Context7 API Token',
        placeHolder: 'Paste your Context7 API token',
        ignoreFocusOut: true,
        password: true,
        validateInput: (v) => (v && v.trim().length > 0 ? undefined : 'Token is required'),
    })
    if (!token) return undefined
    const trimmed = token.trim()
    if (!extensionContext) return undefined
    await extensionContext.secrets.store(CONTEXT7_TOKEN_SECRET_KEY, trimmed)
    return trimmed
}

export async function setupOrUpdateContext7Token(): Promise<void> {
    try {
        const token = await updateToken()
        if (token) {
            void vscode.window.showInformationMessage('Context7 API token stored securely.')
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        vscode.window.showErrorMessage(`Failed to store Context7 token: ${message}`)
    }
}

export async function hasContext7Token(): Promise<boolean> {
    return !!(await getToken())
}

async function handleAuthError(): Promise<string | undefined> {
    const items: vscode.QuickPickItem[] = [
        {
            label: 'Update API-token `context7`',
            description: 'Change stored Context7 API token',
        },
        {
            label: 'Delete API-token `context7`',
            description: 'Remove stored token and continue without authorization',
        },
    ]

    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Context7 API token is invalid',
        ignoreFocusOut: true,
    })
    if (!pick) return undefined

    if (pick.label === 'Update API-token `context7`') {
        return await updateToken()
    } else {
        await deleteToken()
        return undefined
    }
}

export async function fetchContext7(
    url: string,
    signal?: AbortSignal,
): Promise<Response> {
    while (true) {
        const token = await getToken()
        const headers: Record<string, string> = { 'X-Context7-Source': 'vscode-extension' }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        const res = await fetch(url, { method: 'GET', signal, headers })

        if (res.status === 401 || res.status === 403) {
            if (!token) {
                // No token was used, so auth error shouldn't happen - just return error
                return res
            }
            // Token exists but failed - show menu
            const newToken = await handleAuthError()
            if (newToken === undefined && !(await getToken())) {
                // User deleted token or canceled - retry without token
                continue
            }
            // Retry with new token or no token
            continue
        }

        return res
    }
}
