import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from 'fs';
import * as path from 'path';
import * as home from 'user-home';
import * as yml from 'js-yaml';

export function activate(context: vscode.ExtensionContext) {
    const kubiOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Kubi');
    const kubiStatusChannel: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

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
                    refreshStatusBar(kubiStatusChannel, `${kubiEndpoint} - failed`);
                    vscode.window.showErrorMessage(`${kubiLogin} : ${stdout} - Response from '${kubiEndpoint}'`);
                    return;
                }
                if (stdout) {
                    vscode.window.showInformationMessage(stdout);
                    refreshStatusBar(kubiStatusChannel, `${kubiEndpoint}`);
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

    // Retrieve in user settings a comma separated list of kubi-url to display a picking list.
    // Response is used as new default kubi endpoint in user kubi-lite extension settings
    let switchDefaultEndpoint = vscode.commands.registerCommand('extension.vskubi-default-endpoint-switch', async () => {
        const kubiEndpointList = <string>vscode.workspace.getConfiguration('Kubi').get('endpoint-list');
        if (kubiEndpointList) {
            let list = kubiEndpointList.split(',');
            let newValue = await vscode.window.showQuickPick(list, { placeHolder: 'Select the default kubi endpoint' });
            vscode.workspace.getConfiguration('Kubi').update('endpoint-default', newValue);
        }
    });

    // Retrieve in user settings a comma separated list of favorite namespaces to display a picking list.
    // Response is used as new default kubi endpoint in user kubi-lite extension settings
    let switchDefaultNamespace = vscode.commands.registerCommand('extension.vskubi-default-namespace-switch', async () => {
        const kubiNamespaceList = <string>vscode.workspace.getConfiguration('Kubi').get('favoriteNamespaces');
        if (kubiNamespaceList) {
            let list = kubiNamespaceList.split(',');
            let newValue = await vscode.window.showQuickPick(list, { placeHolder: 'Select new default namespace' });
            if (newValue) {
                updateKubeConfigNamespace(newValue);
                vscode.commands.executeCommand('extension.vsKubernetesRefreshExplorer');
            }
        }
    });

    context.subscriptions.push(identity);
    context.subscriptions.push(switchDefaultEndpoint);
    context.subscriptions.push(switchDefaultNamespace);

}

// Display kubi cluster endpoint in status bar after successful cnx
function refreshStatusBar(kubiStatusChannel: vscode.StatusBarItem, endpoint: string) {
    let shortTxt: string = endpoint.replace(/.*\/\w+\./, ''); // cleaning endpoint by removing scheme and first word from url
    kubiStatusChannel.text = shortTxt;
    kubiStatusChannel.tooltip = `Kubi current used endpoint : ${shortTxt}`;
    kubiStatusChannel.show();
}

// Write directly in the KubeConfig file a new default context namespace 
function updateKubeConfigNamespace(ns: string | undefined): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const config = getDefaultKubeConfigPath();
        fs.readFile(config, { encoding: 'utf-8' }, (readErr, data) => {
            if (readErr) {
                reject(readErr.message);
                return;
            }

            // load and parse yaml kubeConfig file data
            const doc = yml.safeLoad(data);
            if (!doc) {
                reject(`${config} is not a valid yaml file`);
                return;
            }

            // find in the contexts array the one with the name attribute value matching the 'current-context' value
            const myCurrentContext = doc['contexts'].find((element: { name: string; }) => element.name === doc['current-context']);
            // set the new namespace value in the current context
            myCurrentContext.context.namespace = ns;

            // write changes to file
            fs.writeFile(config, yml.safeDump(doc), (writeErr) => {
                if (writeErr) {
                    reject(`couldn't update ${config}: ${writeErr.message}`);
                    return;
                }

                resolve();
                return;
            });
        });
    });
}

// Magicaly find kubeConfig, from $ENV or homedir 
function getDefaultKubeConfigPath(): string {
    if (process.env.KUBECONFIG && process.env.KUBECONFIG.length > 0) {
        const files = process.env.KUBECONFIG.split(path.delimiter);
        return files[0];
    }
    return path.join(home, ".kube", "config");
}

export function deactivate() { }
