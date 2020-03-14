import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from 'fs';
import * as path from 'path';
import * as yml from 'js-yaml';

export function activate(context: vscode.ExtensionContext) {
    const kubiOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Kubi');
    const kubiStatusChannel: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

    // Main function - Authentification against default kubi endpoint
    let identity = vscode.commands.registerCommand('extension.vskubi-identity', () => {
        const kubiPath = vscode.workspace.getConfiguration('Kubi').get('path');
        const kubiLogin = vscode.workspace.getConfiguration('Kubi').get('login');
        const kubiAction = vscode.workspace.getConfiguration('Kubi').get('action');
        const kubiExtra = vscode.workspace.getConfiguration('Kubi').get('extra');
        let kubiEndpoint = vscode.workspace.getConfiguration('Kubi').get('endpoint-default');
        
        vscode.window.showInputBox({
            prompt: "Password ?",
            placeHolder: "Please type your password",
            password: true,
            ignoreFocusOut: true,
        }).then((kubiPwd?: string) => {
            // entering pwd modalbox promise

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
                    refreshStatusBar(kubiStatusChannel, `${kubiEndpoint} - failed`);
                    vscode.window.showErrorMessage(`${kubiLogin} : ${stdout} - Response from '${kubiEndpoint}'`);
                    return;
                }
                if (stdout) {
                    vscode.window.showInformationMessage(stdout);
                    refreshStatusBar(kubiStatusChannel, `${kubiEndpoint}`);
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

    // Retrieve in user settings a comma separated list of kubi-url to display a picking list.
    // Response is used as new default kubi endpoint in user kubi-lite extension settings
    let switchDefaultEndpoint = vscode.commands.registerCommand('extension.vskubi-default-endpoint-switch', async () => {
        const kubiEndpointList = <string>vscode.workspace.getConfiguration('Kubi').get('endpoint-list');
        if (kubiEndpointList) {
            let list = kubiEndpointList.split(',');
            let newValue = await vscode.window.showQuickPick(list, { placeHolder: 'Select the default kubi endpoint' });
            if (newValue) {
                await vscode.workspace.getConfiguration('Kubi').update('endpoint-default', newValue); //await instruction avoid to launch kubi-identity before the update is finished
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
            let updatedFavsList = await testFavoritesNS(kubiOutputChannel, userFavsList);
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
                await updateKubeConfigNamespace(newValue); //set new default namespace in kubeconfig
                vscode.commands.executeCommand('workbench.view.extension.kubernetesView'); // focus on kube view
                vscode.commands.executeCommand('extension.vsKubernetesRefreshExplorer'); // ask a refresh to extension kubernetes explorer view
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
        const config = path.join(require('os').homedir(), ".kube", "config").normalize();
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

// Test each namespace retrieved from kube api server against user fovorites
// partial match available : ['sys','pub'] will return ['kube-public','kube-system']
function testFavoritesNS(kubiOutputChannel: vscode.OutputChannel, favs: string[]): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
        // default return array
        const matchingNamespaces: (string | string[])[] = [];       
        // get kubectl form microsoft extension
        const kubectlPath = vscode.workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.kubectl-path'];
        let cmd = `${kubectlPath} get ns -o json`;
        // spawning child processus (kubi-cli itself)
        child_process.exec(cmd, (err, stdout) => {
            if (err) {
                kubiOutputChannel.appendLine('');
                kubiOutputChannel.appendLine(new Date().toLocaleString());
                kubiOutputChannel.appendLine('You can directly test your command in cli as generated here :');
                kubiOutputChannel.appendLine('\t' + cmd);
                kubiOutputChannel.appendLine('Error detected :');
                kubiOutputChannel.appendLine('\t' + `${kubectlPath} : ${stdout} ${err}`);
                vscode.window.showErrorMessage(`${kubectlPath} : ${stdout} ${err}`);
                return;
            }
            if (stdout) {
                let response = JSON.parse(stdout);
                // only if some namespaces are returned
                if (response.items.length > 0) {
                    // flattening and reducing response object to names only
                    let namespaces = response.items.map((item: { metadata: { name: any; }; }) => item.metadata?.name);
                    namespaces.forEach((ns: string | string[]) => {
                        // compare and store each namespace matching each user favorites, even partially (sys -> kube-system)
                        favs.forEach(fav => {
                            if (ns?.includes(fav)) {
                                matchingNamespaces.push(ns);
                            }
                        });
                    });
                    // sort and de-deduplicate results before resolving promise
                    matchingNamespaces.sort();
                    resolve(<string[]>Array.from(new Set(matchingNamespaces)));
                    return;
                }
            }
        });
                
         
    });
}

/*
import * as k8s from '@kubernetes/client-node';
// Fct replaced by a kubectl call, because this client have a network bug on nodejs v10.x, do not working well in proxy enterprise world
// Test each namespace retrieved from kube api server against user fovorites
// partial match available : ['sys','pub'] will return ['kube-public','kube-system']
function testFavoritesNSjsclient(kubiOutputChannel: vscode.OutputChannel, favs: string[]): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
        
        // default return array
        const matchingNamespaces: (string | string[])[] = [];
        kubiOutputChannel.appendLine('DEBUG - inside test ns');

        // load default kubeConfig (from home/.kube/config) and create a kube client
        const kc = new k8s.KubeConfig();
        kubiOutputChannel.appendLine('DEBUG - new kubeconfig');

        kc.loadFromDefault();
        kubiOutputChannel.appendLine('DEBUG - kubeconfig loaded');

        
        kubiOutputChannel.appendLine('DEBUG - create k8s client : ' + kc.clusters[0].name);
        kubiOutputChannel.appendLine('DEBUG - create k8s client : ' + kc.users[0].name);

        const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        kubiOutputChannel.appendLine('DEBUG - created k8s client');

        // get namespaces object from Kube api server
        k8sApi.listNamespace().then((nsResponse) => {
            kubiOutputChannel.appendLine('DEBUG - promise');
            // if kube say OK, parse body items 'namespaces'
            if (nsResponse.response.statusCode === 200) {
                kubiOutputChannel.appendLine('DEBUG - NS found');
                // only if some namespaces are returned
                if (nsResponse.body.items.length > 0) {
                    kubiOutputChannel.appendLine('DEBUG - NS >0');
                    // flatten and reduce response object to names only
                    let namespaces = nsResponse.body.items.map((item) => item.metadata?.name);
                    namespaces.forEach((ns) => {
                        // compare and store each namespace matching each user favorites, even partially (sys -> kube-system)
                        favs.forEach(fav => {
                            if (ns?.includes(fav)) {
                                matchingNamespaces.push(ns);
                            }
                        });
                    });
                    // sort and de-deduplicate results
                    matchingNamespaces.sort();
                    kubiOutputChannel.appendLine('DEBUG - NS sorted');
                    resolve(<string[]>Array.from(new Set(matchingNamespaces)));
                    return;
                }
            }
            else {
                kubiOutputChannel.appendLine('DEBUG - promise : ' + nsResponse.response.statusCode);
            }
            kubiOutputChannel.appendLine('DEBUG - NS not found');
        });
    });
}
*/

export function deactivate() { }