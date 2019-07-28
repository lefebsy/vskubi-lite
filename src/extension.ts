import * as vscode from 'vscode';
import * as child_process from "child_process";

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.vskubi-lite', () => {
		const kubiPath = vscode.workspace.getConfiguration('Kubi').get('path');
        const kubiEndpoint = vscode.workspace.getConfiguration('Kubi').get('endpoint');
        const kubiLogin = vscode.workspace.getConfiguration('Kubi').get('login');

		vscode.window.showInputBox({
            prompt: "Password ?",
            placeHolder: "Please type your password",
            password: true,
            ignoreFocusOut: true,
        }).then((kubiPwd?: string) => {
            //entering pwd promise
            if (!kubiPwd) {
                return;
            }
            // building command
            var kubiCommand = `${kubiPath} --username ${kubiLogin} --password ${kubiPwd} --kubi-url ${kubiEndpoint} --generate-config`;

            //spawning child processus
            child_process.exec(kubiCommand, (err, stdout) => {
                if (err) {
                    console.error(err);
                    vscode.window.showErrorMessage(stdout);
                    return;
                }
                if (stdout) {
                    vscode.window.showInformationMessage(stdout);
                }
            });
        });
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
