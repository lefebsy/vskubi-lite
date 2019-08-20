import * as vscode from 'vscode';
import * as child_process from "child_process";

export function activate(context: vscode.ExtensionContext) {
    const kubiOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Kubi');

	let disposable = vscode.commands.registerCommand('extension.vskubi-lite', () => {
		const kubiPath = vscode.workspace.getConfiguration('Kubi').get('path');
        const kubiEndpoint = vscode.workspace.getConfiguration('Kubi').get('endpoint');
        const kubiLogin = vscode.workspace.getConfiguration('Kubi').get('login');
        const kubiAction = vscode.workspace.getConfiguration('Kubi').get('action');
        const kubiExtra = vscode.workspace.getConfiguration('Kubi').get('extra');

		vscode.window.showInputBox({
            prompt: "Password ?",
            placeHolder: "Please type your password",
            password: true,
            ignoreFocusOut: true,
        }).then((kubiPwd?: string) => {
            //entering pwd modalbox promise

            if (!kubiPwd) {
                return; //quit if no password
            }

            // building command
            let kubiCommand = `${kubiPath} ${kubiExtra} --username ${kubiLogin} --password ${kubiPwd} --kubi-url ${kubiEndpoint} --${kubiAction}`;

            //spawning child processus
            child_process.exec(kubiCommand, (err, stdout) => {
                if (err) {
                    console.error(err);
                    vscode.window.showErrorMessage(`${kubiLogin} : ${stdout}`);
                    if (kubiAction === "generate-token") {
                        kubiOutputChannel.appendLine("Generated token :");
                        kubiOutputChannel.appendLine(stdout);
                    }
                    return;
                }
                if (stdout) {
                    vscode.window.showInformationMessage(stdout);
                    if (kubiAction === "generate-token") {
                        kubiOutputChannel.appendLine("Generated token :");
                        kubiOutputChannel.appendLine(stdout);
                    }
                }
            });
        });
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
