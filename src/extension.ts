import * as vscode from 'vscode';
import * as path from 'path';
import { collectSealSelectedTextUserInput } from './userInput';
import { sealSecretRaw, sealSecretFile } from './seal';
import { collectSealSelectedTextDefaults } from './defaults';
import * as os from 'os';
import * as fs from 'fs';

let extensionState = {
	kubeSealPath: ''
}

export function activate(context: vscode.ExtensionContext) {

	console.log('Activating kubeseal extension');

	function initializeConfiguration() {
		const kubesealConfiguration = vscode.workspace.getConfiguration('kubeseal')
		const configuredKubeSealPath = kubesealConfiguration.get<string>('executablePath')
		if (os.platform() == 'win32') {
			extensionState.kubeSealPath = configuredKubeSealPath || path.join(context.extensionPath, 'bin', 'kubeseal.exe')
		} else {
			if (configuredKubeSealPath) {
				extensionState.kubeSealPath = configuredKubeSealPath
			}
			else {
				vscode.window.showErrorMessage('kubeseal.executablePath not set')
			}
		}

		if (!fs.existsSync(extensionState.kubeSealPath)) {
			vscode.window.showErrorMessage(`kubeseal.executablePath is set to ${extensionState.kubeSealPath} which does not exist`)
		}
	}

	initializeConfiguration()

	const configSubscription = vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('kubeseal')) {
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

