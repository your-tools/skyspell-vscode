import * as vscode from 'vscode';
import checkProject from './check';

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('skyspell.check', () => {
		checkProject()
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}