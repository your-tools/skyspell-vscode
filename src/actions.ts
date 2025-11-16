import * as vscode from "vscode";
import { DIAGNOSTIC_CODE, Suggestions } from "./checker";
import { Scope } from "./skyspell";
import { ADD_WORD, Extension } from "./extension";

export default class SkyspellActions implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];
  extension: Extension;

  constructor(extension: Extension) {
    this.extension = extension;
  }

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

    const suggestions = this.extension.suggestions[word];
    const replaceActions = suggestions.map((suggestion) =>
      this.createReplaceAction({ word, suggestion, diagnostic, document })
    );

    const scopes: Scope[] = ["project", "file", "extension", "lang"];
    const addActions = scopes.map((scope) =>
      this.createAddAction({ document, word, diagnostic, scope })
    );

    return replaceActions.concat(addActions);
  }

  createReplaceAction({
    word,
    suggestion,
    diagnostic,
    document,
  }: {
    word: string;
    suggestion: string;
    diagnostic: vscode.Diagnostic;
    document: vscode.TextDocument;
  }): vscode.CodeAction {
    const title = suggestion;
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);

    const range = diagnostic.range;
    action.edit = new vscode.WorkspaceEdit();

    action.edit.replace(
      document.uri,
      new vscode.Range(range.start, range.end),
      suggestion
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  createAddAction({
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
