import * as assert from 'assert';
import * as vscode from 'vscode';
import sinon, { stubInterface  } from "ts-sinon";
import { beforeEach, afterEach } from "mocha";
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as path from 'path'
import * as yaml from 'js-yaml'
import { Scope } from '../../types'

suite('Extension Test Suite', () => {

	let createQuickPickStub : sinon.SinonStub; 
	let createInputBoxStub : sinon.SinonStub;  
	
	beforeEach(() => {
		createQuickPickStub = sinon.stub(vscode.window, 'createQuickPick')
		createInputBoxStub = sinon.stub(vscode.window, 'createInputBox')
	});
	  	
	afterEach(() => {
		createQuickPickStub.restore();
		createInputBoxStub.restore();
	});
	  	
    test("Extension should be present", () => {
        assert.ok(vscode.extensions.getExtension('codecontemplator.kubeseal'));
	});	
	
    test("Extension should activate", async () => {
		const extension = await vscode.extensions.getExtension('codecontemplator.kubeseal')
		await extension?.activate()
	});
		
	function setupQuickPickStub() {
        createQuickPickStub.callsFake(() => {
			var quickPickStub = stubInterface<vscode.QuickPick<vscode.QuickPickItem>>();
			quickPickStub.onDidChangeSelection.callsFake(handler => {
				switch(quickPickStub.placeholder)
				{
					case 'Select scope':
						const selectedItem = quickPickStub.items.find(x => x.label == Scope[Scope.strict]);
						const items = [];
						if (selectedItem) items.push(selectedItem);
						return handler(items);
					default:
						throw 'Unhandled quick pick';
				}
			});
			return quickPickStub;
		});
	}

	function setupInputBoxStub() {
		createInputBoxStub.callsFake(() => {
			var inputBoxStub = stubInterface<vscode.InputBox>();
			inputBoxStub.onDidAccept.callsFake(asyncHandler => {
				switch(inputBoxStub.prompt)
				{
					case 'Specify name':
						inputBoxStub.value = 'fake-name';
						break;
					case 'Specify namespace':
						inputBoxStub.value = 'fake-namespace';
						break;
					case 'Specify certificate path':
						inputBoxStub.value = path.resolve(__dirname, '../../../example/cert.pem')
						break;
					default:
						throw 'Unhandled input box';
				}

				return asyncHandler();
			});
			return inputBoxStub;
		});
	}

	test('Convert secret file to sealed secret file', async () => {

		setupQuickPickStub()
		setupInputBoxStub()
				
		const temporaryFile = tmp.fileSync();
		try
		{
			// Create a temporary file with a kubernetes secret that will be transformed into a sealed secret
			fs.writeFileSync(temporaryFile.name, `
apiVersion: v1
kind: Secret
metadata:
  name: exampleSecret
#  namespace: exampleNamespace
type: Opaque
data:
  username: YWRtaW4=
  password: MWYyZDFlMmU2N2Rm
`);

			// Activate extension
			const extension = await vscode.extensions.getExtension('codecontemplator.kubeseal')
			await extension?.activate()
	
			// Close all editors to get a good initial state
			await vscode.commands.executeCommand('workbench.action.closeAllEditors')
			assert.equal(vscode.workspace.textDocuments.length, 0)

			// Open secret file
			const textDocument = await vscode.workspace.openTextDocument(temporaryFile.name) //({ content: secretFileContent })
			await vscode.window.showTextDocument(textDocument)
			assert.notEqual(textDocument, null);
			assert.equal(vscode.workspace.textDocuments.length, 1)			

			// Execute seal secret file command - This is our 'act' step
			await vscode.commands.executeCommand('extension.sealKubeSecretFile')

			// Assert expected result
			assert.equal(vscode.workspace.textDocuments.length, 2)
			const resultDocument = vscode.workspace.textDocuments.find(x => x != textDocument)
			const resultText = resultDocument?.getText()
			if (!resultText) assert.fail()
			const yamlResult = yaml.safeLoad(resultText)
			assert.ok(yamlResult)
			assert.equal(yamlResult.kind, 'SealedSecret')
			assert.equal(yamlResult.metadata.name, 'fake-name')
			assert.equal(yamlResult.metadata.namespace, 'fake-namespace')
			assert.ok(yamlResult.spec.encryptedData.password)
			assert.ok(yamlResult.spec.encryptedData.username)
		}
		finally
		{
			temporaryFile.removeCallback();
		}
	});
});
