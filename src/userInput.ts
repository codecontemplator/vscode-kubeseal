// Ref: https://github.com/microsoft/vscode-extension-samples/blob/master/quickinput-sample/src/multiStepInput.ts
import { QuickPickItem, window, Disposable, CancellationToken, QuickInputButton, QuickInput, ExtensionContext, QuickInputButtons, Uri, QuickPick } from 'vscode';
import { Scope, SealSecretParameters } from './types';
import * as fs from 'fs';

export async function collectSealSecretUserInput(
		context: ExtensionContext, 
		defaults: SealSecretParameters | null
	) : Promise<SealSecretParameters> {

	const scopes: QuickPickItem[] = [Scope.strict, Scope.namespaceWide, Scope.clusterWide].map(scope => ({ label: Scope[scope] }));
	// Object.keys(Scope).map(label => ({ label }));

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		scope: QuickPickItem;
		scopeValue?: Scope;
		name: string;
		namespace: string;
		certificatePath: string;
	}

	async function collectInputs() {
		const state = { } as Partial<State>
		state.name = defaults?.name
		state.namespace = defaults?.namespace
		state.certificatePath = defaults?.certificatePath
		if (defaults?.scope) {
			state.scopeValue = defaults?.scope
			state.scope = scopes[defaults?.scope - 1]
		}

		await MultiStepInput.run(input => pickScope(input, state));
		return state as State;
	}

	const title = 'Seal Secret';

	async function pickScope(input: MultiStepInput, state: Partial<State>) {
		state.scope = await input.showQuickPick({
			title,
			step: 1,
			totalSteps: 2,
			placeholder: 'Select scope',
			items: scopes,
			activeItem: state.scope,
			shouldResume: shouldResume
		});

		switch(state.scope.label) {
			case Scope[Scope.strict]:
				state.scopeValue = Scope.strict;
				return (input: MultiStepInput) => inputName(input, state);
			case Scope[Scope.namespaceWide]:
				state.scopeValue = Scope.namespaceWide;
				return (input: MultiStepInput) => inputNamespace(input, state);
			case Scope[Scope.clusterWide]:
				state.scopeValue = Scope.clusterWide;
				return (input: MultiStepInput) => inputCertificatePath(input, state);
		}
	}
	
	async function inputName(input: MultiStepInput, state: Partial<State>) {
		state.name = await input.showInputBox({
			title,
			step: 2,
			totalSteps: 4,
			value: state.name || '',
			prompt: 'Specify name',
			validate: validateName,
			shouldResume: shouldResume
		});
		return (input: MultiStepInput) => inputNamespace(input, state);
	}

	async function inputNamespace(input: MultiStepInput, state: Partial<State>) {
		state.namespace = await input.showInputBox({
			title,
			step: state.scopeValue === Scope.strict ? 3 : 2,
			totalSteps: state.scopeValue === Scope.strict ? 4 : 3,
			value: state.namespace || '',
			prompt: 'Specify namespace',
			validate: validateNamespace,
			shouldResume: shouldResume
		});

		return (input: MultiStepInput) => inputCertificatePath(input, state);
	}

	async function inputCertificatePath(input: MultiStepInput, state: Partial<State>) {
		state.certificatePath = await input.showInputBox({
			title,
			step: state.scopeValue === Scope.strict ? 3 : 3,
			totalSteps: state.scopeValue === Scope.strict ? 4 : 4,
			value: state.certificatePath || '',
			prompt: 'Specify certificate path',
			validate: validateCertificatePath,
			shouldResume: shouldResume
		});
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((resolve, reject) => {

		});
	}

	async function validateName(name: string) {
		// ...validate...
		//await new Promise(resolve => setTimeout(resolve, 1000));
		//return name === 'vscode' ? 'Name not unique' : undefined;
		return Promise.resolve(name ? undefined : 'Please specify name');
	}

	async function validateNamespace(namespace: string) {
		// ...validate...
		//await new Promise(resolve => setTimeout(resolve, 1000));
		//return name === 'vscode' ? 'Name not unique' : undefined;
		return Promise.resolve(namespace ? undefined : 'Please specify namespace');
	}

	async function validateCertificatePath(certificatePath: string) {
		// do async
		return Promise.resolve(fs.existsSync(certificatePath) ? undefined : 'File not found'); 
	}

	const state = await collectInputs();
	//window.showInformationMessage(`Sealing secret ${state.name} ${state.namespace} ${state.scope.label}`);
	return {
		scope: state.scopeValue,
		name: state.name,
		namespace: state.namespace,
		certificatePath: state.certificatePath
	}
}


// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------


class InputFlowAction {
	private constructor() { }
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	validate: (value: string) => Promise<string | undefined>;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => {
				if (d && typeof d.dispose == 'function') { d.dispose() }				
			});
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						if (!(await validate(value))) {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidChangeValue(async text => {
						const current = validate(text);
						validating = current;
						const validationMessage = await current;
						if (current === validating) {
							input.validationMessage = validationMessage;
						}
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => {
				if (d  && typeof d.dispose == 'function') { d.dispose() }				
			});
		}
	}
}
