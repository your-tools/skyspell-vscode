import * as vscode from "vscode";
import { DIAGNOSTIC_CODE } from "./checker";
import { Scope } from "./skyspell";

export const ADD_WORD = "skyspell.addWord";

export class SkyspellAction implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    return context.diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODE)
      .map((diagnostic) => this.createCodeActions(diagnostic, document))
      .flat();
  }

  private createCodeActions(
    diagnostic: vscode.Diagnostic,
    document: vscode.TextDocument
  ): vscode.CodeAction[] {
    const { range } = diagnostic;
    const word = document.getText(range);

    const scopes: Scope[] = ["project", "file"];
    const actions = scopes.map((scope) =>
      this.createCommandAction({ document, word, diagnostic, scope })
    );
    return actions;
  }

  createCommandAction({
    document,
    word,
    scope,
    diagnostic,
  }: {
    document: vscode.TextDocument;
    word: string;
    scope: Scope;
    diagnostic: vscode.Diagnostic;
  }) {
    const title = `Add to ${scope}`;

    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);

    action.command = {
      command: ADD_WORD,
      title,
      arguments: [document, word, scope],
    };
    action.diagnostics = [diagnostic];
    return action;
  }
}
