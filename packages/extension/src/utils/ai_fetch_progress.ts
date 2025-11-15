// Webview to show AI fetch progress: left = fetched Markdown content, right = streaming model output
import * as vscode from 'vscode';
import { env } from '../utils/env';
import { getSession } from './ai_fetch_sessions';

export async function openAiFetchProgressPanelByUid(uid: string): Promise<void> {
  let session = getSession(uid);
  // Wait briefly for session to become available (user might click immediately after prepareInvocation)
  if (!session) {
    const deadline = Date.now() + 30000;
    while (!session && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 150));
      session = getSession(uid);
    }
    if (!session) {
      vscode.window.showErrorMessage('No active ai_fetch_url session found for this link.');
      return;
    }
  }

  // If a panel already exists for this session, just focus it instead of creating a duplicate
  if (session.panel) {
    session.panel.reveal(undefined, false);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'reliefpilot.aiFetchProgress',
    'Relief Pilot: AI Fetch Progress',
    { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(env.extensionUri, 'media')],
    },
  );

  // Bind this panel to the session so subsequent invocations focus the existing one
  session.panel = panel;

  try {
    const iconUri = vscode.Uri.joinPath(env.extensionUri, 'icon_mono.png');
    panel.iconPath = iconUri;
  } catch {
    // ignore icon assignment errors
  }

  const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(env.extensionUri, 'media', 'highlight.github.css'));
  const enhanceCssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(env.extensionUri, 'media', 'markdown-enhance.css'));
  const markdownDepsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(env.extensionUri, 'media', 'markdown-deps.js'));
  const markdownEnhanceUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(env.extensionUri, 'media', 'markdown-enhance.js'));

  const nonce = Math.random().toString(36).slice(2);
  const csp = [
    "default-src 'none'",
    `img-src ${panel.webview.cspSource} blob: data:`,
    `style-src ${panel.webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
  const fetchedTitle = `Fetched content (${session.modelId} ${session.modelMaxInputTokens})`;

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <link rel="stylesheet" href="${enhanceCssUri}" />
    <title>Relief Pilot: AI Fetch Progress</title>
  <style>
      html, body { height: 100%; }
      body { margin: 0; font-family: var(--vscode-font-family, system-ui, Arial, sans-serif); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      .layout { display: grid; grid-template-columns: 1fr 1px 1fr; height: 100vh; }
      .col { overflow: auto; padding: 12px; }
      .divider { background: var(--vscode-editorGroup-border); }
      .section-title { font-size: 12px; opacity: 0.8; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .08em; }
      pre.reasoning { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); padding: 8px; white-space: pre-wrap; font-size: 12px; line-height: 1.4; border-radius: 4px; }
      .markdown { line-height: 1.5; }
  .stream { white-space: pre-wrap; }
  /* Right stream now rendered as markdown; preserve pre-wrap for incremental feel */
  #rightStream.markdown { white-space: pre-wrap; }
      .muted { opacity: 0.7; }
    </style>
  </head>
  <body>
    <div class="layout">
      <div class="col" id="left">
        <p class="section-title">${fetchedTitle}</p>
        <section class="markdown" id="leftMd"></section>
      </div>
      <div class="divider"></div>
      <div class="col" id="right">
        <p class="section-title" id="rightTitle">Model stream</p>
        <section class="markdown" id="rightStream"></section>
      </div>
    </div>

    <script nonce="${nonce}" src="${markdownDepsUri}"></script>
    <script nonce="${nonce}" src="${markdownEnhanceUri}"></script>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
  const elLeft = document.getElementById('leftMd');
  const elStream = document.getElementById('rightStream');
  const elRightTitle = document.getElementById('rightTitle');
  const sessionStartedAt = ${JSON.stringify(session.startedAt)};
  const sessionFinishedAtInitial = ${JSON.stringify(session.finishedAt ?? null)};
  let streamBuffer = '';
  let timerId;
  let completedAt = (typeof sessionFinishedAtInitial === 'number' && isFinite(sessionFinishedAtInitial))
    ? sessionFinishedAtInitial
    : null;

  function formatDuration(ms) {
        if (!Number.isFinite(ms) || ms < 0) return '';
        const totalSeconds = Math.floor(ms / 1000);
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);
        if (hours > 0) {
          return hours + 'h ' + minutes + 'm';
        }
        if (minutes > 0) {
          return minutes + 'm ' + seconds + 's';
        }
        return seconds + 's';
  }

  function updateRightTitle() {
        if (!elRightTitle) return;
        const endTime = completedAt != null ? completedAt : Date.now();
        const elapsed = endTime - sessionStartedAt;
        const suffix = formatDuration(elapsed);
    elRightTitle.textContent = suffix ? 'Model stream (' + suffix + ')' : 'Model stream';
  }

  if (completedAt == null) {
    timerId = window.setInterval(updateRightTitle, 1000);
  }
  updateRightTitle();
  // reasoning stream is not available from tool-side; we only show text stream

      window.addEventListener('message', (e) => {
        const msg = e.data || {};
        if (msg.type === 'left') {
          try {
            if (window.ReliefPilotMarkdownEnhancer) {
              window.ReliefPilotMarkdownEnhancer.render(elLeft, msg.markdown || '', (text) => { try { navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(text); } catch {} });
            } else if (window.marked) {
              elLeft.innerHTML = window.marked.parse(msg.markdown || '');
            } else {
              elLeft.textContent = msg.markdown || '';
            }
          } catch { elLeft.textContent = msg.markdown || ''; }
        } else if (msg.type === 'right-text') {
          streamBuffer += msg.chunk || '';
          try {
            if (window.ReliefPilotMarkdownEnhancer) {
              window.ReliefPilotMarkdownEnhancer.render(elStream, streamBuffer, (text) => { try { navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(text); } catch {} });
            } else if (window.marked) {
              elStream.innerHTML = window.marked.parse(streamBuffer || '');
            } else {
              elStream.textContent = streamBuffer || '';
            }
          } catch { elStream.textContent = streamBuffer || ''; }
        } else if (msg.type === 'right-done') {
          completedAt = Date.now();
          if (timerId) {
            window.clearInterval(timerId);
            timerId = undefined;
          }
          updateRightTitle();
        }
      });

      window.addEventListener('unload', () => {
        if (timerId) {
          window.clearInterval(timerId);
          timerId = undefined;
        }
      });
    </script>
  </body>
</html>`;

  const tokenSource = new vscode.CancellationTokenSource();
  panel.onDidDispose(() => tokenSource.cancel());

  // Bind to the running session: forward events into webview
  const leftSub = session.leftEmitter.event((md: string) => panel.webview.postMessage({ type: 'left', markdown: md }));
  const rightTextSub = session.rightTextEmitter.event((chunk: string) => panel.webview.postMessage({ type: 'right-text', chunk }));
  const rightDoneSub = session.rightDoneEmitter.event(() => panel.webview.postMessage({ type: 'right-done' }));


  panel.onDidDispose(() => {
    leftSub.dispose();
    rightTextSub.dispose();
    rightDoneSub.dispose();
    // Clear the panel reference and state on dispose
    if (session) {
      session.panel = undefined;
    }
  });

  // Replay buffered content if any (user opened late)
  if (session.leftBuffer) {
    panel.webview.postMessage({ type: 'left', markdown: session.leftBuffer });
  }
  if (session.rightTextBuffer) {
    panel.webview.postMessage({ type: 'right-text', chunk: session.rightTextBuffer });
  }
}
