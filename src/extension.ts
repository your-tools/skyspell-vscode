import * as vscode from "vscode";
import Checker from "./checker";

type State = { projectPath?: string };

const state: State = {};

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.enableSpellChecking",
    () => {
      vscode.window.showInformationMessage("Spell checking enabled");

      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        const folder = folders[0];
        state.projectPath = folder.uri.fsPath;
      }
    }
  );

  const diagnostics = vscode.languages.createDiagnosticCollection("skyspell");

  context.subscriptions.push(diagnostics);

  const handleSave = async (doc: vscode.TextDocument) => {
    const { projectPath } = state;
    if (!projectPath) {
      return;
    }

    const checker = new Checker({
      doc,
      diagnostics,
      projectPath,
    });

    await checker.runSkyspell();
  };

  const handleClose = (doc: vscode.TextDocument) => {
    diagnostics.delete(doc.uri);
  };

  vscode.workspace.onDidSaveTextDocument(handleSave);
  vscode.workspace.onDidCloseTextDocument(handleClose);

  context.subscriptions.push(disposable);
}
