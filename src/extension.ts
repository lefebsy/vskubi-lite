import * as vscode from 'vscode';
import * as child_process from "child_process";

export function activate(context: vscode.ExtensionContext) {
    const kubiOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Kubi');

    // Main function - Authentification against default kubi endpoint
	let identity = vscode.commands.registerCommand('extension.vskubi-identity', () => {
		const kubiPath = vscode.workspace.getConfiguration('Kubi').get('path');
        const kubiEndpoint = vscode.workspace.getConfiguration('Kubi').get('endpoint-default');
        const kubiLogin = vscode.workspace.getConfiguration('Kubi').get('login');
        const kubiAction = vscode.workspace.getConfiguration('Kubi').get('action');
        const kubiExtra = vscode.workspace.getConfiguration('Kubi').get('extra');

		vscode.window.showInputBox({
            prompt: "Password ?",
            placeHolder: "Please type your password",
            password: true,
            ignoreFocusOut: true,
        }).then((kubiPwd?: string) => {
            // entering pwd modalbox promise

            if (!kubiPwd) {
                return; // quit if no password entered
            }

            // forging command to launch kubi
            let kubiCommand = `${kubiPath} --username ${kubiLogin} --password ${kubiPwd} --kubi-url ${kubiEndpoint} --${kubiAction} ${kubiExtra}`;

            // spawning child processus (kubi itself)
            child_process.exec(kubiCommand, (err, stdout) => {
                if (err) {
                    console.error(err);
                    vscode.window.showErrorMessage(`${kubiLogin} : ${stdout} - Response from '${kubiEndpoint}'`);
                    return;
                }
                if (stdout) {
                    vscode.window.showInformationMessage(stdout);
                    if (kubiAction === "generate-token") {
                        // if no error during authentication stdout is a token, putted in clipboard
                        kubiOutputChannel.appendLine(`Generated token from '${kubiEndpoint}'`);
                        kubiOutputChannel.appendLine('Copied in clipoard :');
                        kubiOutputChannel.appendLine(stdout);
                        vscode.env.clipboard.writeText(stdout); 
                    }
                }
            });
        });
	});

    // retrieve in user settings a comma separated list of kubi-url to display a picking list.
    // choice is used as new default kubi endpoint in user kubi-lite extension settings
    let switchDefaultEndpoint = vscode.commands.registerCommand('extension.vskubi-default-switch', async () => {
        const kubiEndpointList = <string> vscode.workspace.getConfiguration('Kubi').get('endpoint-list');
        if (kubiEndpointList) {
            let list = kubiEndpointList.split(',');
            let newValue = await vscode.window.showQuickPick(list, { placeHolder: 'Select the default kubi endpoint' });
            vscode.workspace.getConfiguration('Kubi').update('endpoint-default', newValue);
        }
    });
    
    context.subscriptions.push(identity);
    context.subscriptions.push(switchDefaultEndpoint);

}

export function deactivate() {}
