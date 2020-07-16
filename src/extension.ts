import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as helpers from './helpers';

import * as k8s from 'vscode-kubernetes-tools-api';

export async function activate(context: vscode.ExtensionContext) {
    const kubiOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Kubi');
    const kubiStatusChannel: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

    // publish in open vsx registry for theia
    // https://github.com/eclipse/openvsx/wiki/Publishing-Extensions

    // ALPHA Feature - extend the Azure extension 'Kubernetes Explorer' with NetPol and Cagip VaultSecrets 
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("Policy", "Policies", "NetworkPolicy", "netpol").at("Network")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("VaultSecret", "VaultSecrets", "VaultSecret", "VaultSecret").at("Configuration")
        );            
    }
    

    // Main function - Authentification against default kubi endpoint
    let identity = vscode.commands.registerCommand('extension.vskubi-identity', () => {
        const kubiPath = vscode.workspace.getConfiguration('Kubi').get('path');      
        const kubiAction = vscode.workspace.getConfiguration('Kubi').get('action');
        const kubiExtra = vscode.workspace.getConfiguration('Kubi').get('extra');
        let kubiEndpoint:string = vscode.workspace.getConfiguration('Kubi').get('endpoint-default','');
        
        helpers.askLogin(kubiEndpoint).then((kubiLogin?:string|undefined) => {

            // quit if no login
            if (!kubiLogin) { return; }

            vscode.window.showInputBox({
                prompt: "Password ?",
                placeHolder: "Please type your password",
                password: true,
                ignoreFocusOut: true,
            }).then((kubiPwd?: string) => {
                // pwd modalbox promise
    
                // quit if no password entered
                if (!kubiPwd) { return; }
    
                // forging command to launch kubi, and one dispayed without password for debug
                let kubiCommand = `${kubiPath} --username ${kubiLogin} --password ${kubiPwd} --kubi-url ${kubiEndpoint} --${kubiAction} ${kubiExtra}`;
                let kubiCommand4Debug = `${kubiPath} --username ${kubiLogin} --kubi-url ${kubiEndpoint} --${kubiAction} ${kubiExtra}`;
    
                // spawning child processus (kubi-cli itself)
                child_process.exec(kubiCommand, (err, stdout) => {
                    if (err) {
                        kubiOutputChannel.appendLine('');
                        kubiOutputChannel.appendLine(new Date().toLocaleString());
                        kubiOutputChannel.appendLine('You can directly test your command in cli as generated here :');
                        kubiOutputChannel.appendLine('\t' + kubiCommand4Debug);
                        kubiOutputChannel.appendLine('Kubi error detected :');
                        kubiOutputChannel.appendLine('\t' + `${kubiEndpoint} with ${kubiLogin} : ${stdout}`);
                        helpers.refreshStatusBar(kubiStatusChannel, `${kubiEndpoint} - failed`);
                        vscode.window.showErrorMessage(`${kubiLogin} : ${stdout} - Response from '${kubiEndpoint}'`);
                        return;
                    }
                    if (stdout) {
                        vscode.window.showInformationMessage(stdout);
                        helpers.refreshStatusBar(kubiStatusChannel, `${kubiEndpoint}`);
                        if (kubiAction === "generate-token") {
                            // if no error during authentication stdout is a token, putted in clipboard and console channel
                            kubiOutputChannel.appendLine(`Generated token from '${kubiEndpoint}'`);
                            kubiOutputChannel.appendLine('Copied in clipoard :');
                            kubiOutputChannel.appendLine(stdout);
                            vscode.env.clipboard.writeText(stdout);
                        }
                        else {
                            // after a kubi generation the default namespace is always 'default', so if favorites are defined :switch
                            if (vscode.workspace.getConfiguration('Kubi').get('favoriteNamespaces')) {
                                vscode.commands.executeCommand('extension.vskubi-default-namespace-switch');
                            }
                            else {
                                // even without favorite namespace, still usefull to refresh view
                                vscode.commands.executeCommand('workbench.view.extension.kubernetesView'); // focus on kube view
                                vscode.commands.executeCommand('extension.vsKubernetesRefreshExplorer'); // ask a refresh to extension kubernetes explorer view
                            }
                        }
                    }
                });
            });

        });
        
    });

    // Map logins to clusters
    let identityMap = vscode.commands.registerCommand('extension.vskubi-identity-map', async () => {

        // retrieve user settings
        const advancedMode = <boolean>vscode.workspace.getConfiguration('Kubi').get('advancedMode');
        const kubiEndpointList = <string>vscode.workspace.getConfiguration('Kubi').get('endpoint-list');
        const kubiLogin = <string>vscode.workspace.getConfiguration('Kubi').get('login','');
        let logins = kubiLogin.split(',');
        let clusters = kubiEndpointList.split(',');
        
        // quick fail
        if (!kubiEndpointList) { return; }
        if (clusters.length === 1) { return; }
        if (logins.length === 1) { return; }
        helpers.identityMapChoice(advancedMode, clusters,logins,JSON.parse('{}'));
    });

    // Retrieve in user settings a comma separated list of kubi-url to display a picking list.
    // Response is used as new default kubi endpoint in user kubi-lite extension settings
    let switchDefaultEndpoint = vscode.commands.registerCommand('extension.vskubi-default-endpoint-switch', async () => {
        const kubiEndpointList = <string>vscode.workspace.getConfiguration('Kubi').get('endpoint-list');
        if (kubiEndpointList) {
            let list = kubiEndpointList.split(',');
            let newValue = await vscode.window.showQuickPick(list, { placeHolder: 'Select the default kubi endpoint' });
            if (newValue) {
                await vscode.workspace.getConfiguration('Kubi').update('endpoint-default', newValue, vscode.ConfigurationTarget.Global); //await instruction avoid to launch kubi-identity before the update is finished
                vscode.commands.executeCommand('extension.vskubi-identity'); // ask to launch authentication function
            }
        }
    });

    // Retrieve in user settings a comma separated list of favorite namespaces to display a picking list.
    // Response is used as new default kubi endpoint in user kubi-lite extension settings
    let switchDefaultNamespace = vscode.commands.registerCommand('extension.vskubi-default-namespace-switch', async () => {
        const kubiNamespaceList = <string>vscode.workspace.getConfiguration('Kubi').get('favoriteNamespaces');
        if (kubiNamespaceList) {
            let userFavsList = kubiNamespaceList.split(',');
            let updatedFavsList = await helpers.testFavoritesNS(kubiOutputChannel, userFavsList);
            let msgHolder = (updatedFavsList.length === 0) ? 'Sorry no favorite namespace found' : 'Select new default namespace';
            let newValue;
            // only one fav, do not need a pickup list, otherwise choose
            if (updatedFavsList.length === 1) {
                newValue = updatedFavsList[0];
            }
            else {
                newValue = await vscode.window.showQuickPick(updatedFavsList, { placeHolder: msgHolder });
            }           
            if (newValue) {
                await helpers.updateKubeConfigNamespace(newValue); //set new default namespace in kubeconfig
                vscode.commands.executeCommand('workbench.view.extension.kubernetesView'); // focus on kube view
                vscode.commands.executeCommand('extension.vsKubernetesRefreshExplorer'); // ask a refresh to extension kubernetes explorer view
            }
        }
    });

    context.subscriptions.push(identity);
    context.subscriptions.push(identityMap);
    context.subscriptions.push(switchDefaultEndpoint);
    context.subscriptions.push(switchDefaultNamespace);

}

export function deactivate() { }