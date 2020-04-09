import * as vscode from 'vscode';
import * as path from 'path';
import { collectSealSelectedTextUserInput } from './userInput';
import { sealSecretRaw, sealSecretFile } from './seal';
import { collectSealSelectedTextDefaults } from './defaults';

let extensionState = {
	kubeSealPath: ''
}

export function activate(context: vscode.ExtensionContext) {

	console.log('Activating kubeseal extension');

	function initializeConfiguration() {
		console.log("Initialize configuration")
		const kubesealConfiguration = vscode.workspace.getConfiguration('kubeseal')
		extensionState.kubeSealPath = kubesealConfiguration.get<string>('executablePath') || path.join(context.extensionPath, 'bin', 'kubeseal.exe')
	}

	initializeConfiguration()

	const configSubscription = vscode.workspace.onDidChangeConfiguration(e => {
		console.log('onDidChangeConfiguration')
		if (e.affectsConfiguration('kubeseal')) {
			console.log('onDidChangeConfiguration affects kubeseal')
			initializeConfiguration()
        }
	});

	context.subscriptions.push(configSubscription);

	//
	// seal secret file
	//

	let sealKubeSecretFileCommand = vscode.commands.registerCommand('extension.sealKubeSecretFile', async () => {

		let editor = vscode.window.activeTextEditor;

		if (editor) {

			if (editor.document.isDirty || editor.document.isUntitled) {
				await vscode.commands.executeCommand('workbench.action.files.saveAs');
			}

			if (editor.document.isDirty || editor.document.isUntitled) {
				return; // user aborted save
			}			

			const document = editor.document;

			// TODO: implement good defaults
			//const defaults = collectSealSelectedTextDefaults(context, document);
			//console.log("defaults", defaults)
			let userInput = await collectSealSelectedTextUserInput(context)

			let sealedSecret = 
				await sealSecretFile(
					extensionState.kubeSealPath,
					userInput.certificatePath,
					document.fileName,
					userInput.scope,
					userInput.name,
					userInput.namespace
					)

			const textDocument = await vscode.workspace.openTextDocument({ content: sealedSecret })
			if (textDocument) {
				await vscode.window.showTextDocument(textDocument, { viewColumn: vscode.ViewColumn.Beside })
			}		
		}
	});
	
	context.subscriptions.push(sealKubeSecretFileCommand);

	//
	// seal secret selection
	//

	let sealKubeSecretSelectedTextCommand = vscode.commands.registerCommand('extension.sealKubeSecretSelectedText', async () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document
			const selection = editor.selection
			
			const defaults = collectSealSelectedTextDefaults(context, document)
			const userInput = await collectSealSelectedTextUserInput(context, defaults.defaultName, defaults.defaultNamespace, defaults.defaultCertificatePath)
			const plainTextSecret = document.getText(selection);

			const sealedSecret = 
				await sealSecretRaw(
					extensionState.kubeSealPath,
					userInput.certificatePath,
					plainTextSecret,
					userInput.scope,
					userInput.name,
					userInput.namespace
					);

			editor.edit(editBuilder => {
				editBuilder.replace(selection, sealedSecret)
			});
		}
	});

	context.subscriptions.push(sealKubeSecretSelectedTextCommand)
}

export function deactivate() {
	console.log('Deactivating kubeseal extension');
}

