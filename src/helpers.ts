import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from 'fs';
import * as path from 'path';
import * as yml from 'js-yaml';


// Retrieve login from settings or ask user from mapped ones
export async function askLogin(kubiEndpoint: string): Promise<string | undefined> {
    const mapSaved: string = vscode.workspace.getConfiguration('Kubi').get('identityMap', '{}');
    let identityMap: Record<string, Array<string>> = (mapSaved === '' ? JSON.parse('{}') : JSON.parse(mapSaved));
    let kubiLogin: string = vscode.workspace.getConfiguration('Kubi').get('login', '');

    // if no login defined at all in settings, quick fail
    if (kubiLogin.length === 0) {
        vscode.window.showErrorMessage("Login setting not found");
        return undefined;
    }

    // only one login defined, direct return
    if (kubiLogin.split(',').length === 1) {
        return kubiLogin.split(',')[0];
    }

    // if multiples logins are defined but not mapped to the cluster...
    if (kubiLogin.split(',').length > 1 && identityMap) {
        if (!identityMap[<any>kubiEndpoint]) {
            vscode.window.showWarningMessage('Please, map at least one login to this cluster endpoint, then retry');
            vscode.commands.executeCommand('extension.vskubi-identity-map');
            return undefined;
        }
    }

    // if only one login is mapped to this cluster
    if (identityMap[<any>kubiEndpoint].length === 1) {
        return identityMap[<any>kubiEndpoint][0];
    }

    // logins are defined for the cluster, let human select one
    return await vscode.window.showQuickPick(identityMap[<any>kubiEndpoint], { placeHolder: 'Select your login' });

}

// Recursive function to display pickinglist about logins mapped to clusters
export function identityMapChoice(advancedMode: boolean, clusters: string[], logins: string[], identityMap: Record<string, Array<string>> | undefined) {
    if (identityMap && logins.length >= 1 && clusters.length >= 1) {
        let cluster = clusters.shift(); //pick first cluster and remove it from the list
        vscode.window.showQuickPick(logins, { canPickMany: true, placeHolder: `Select login(s) to use with : ${cluster}` }).then(async (choice) => {
            if (choice) {
                choice.forEach(login => {
                    // need to initialyse with an empty array before pushing a login
                    if (!identityMap[`${cluster}`] || identityMap[`${cluster}`].length === 0) {
                        identityMap[`${cluster}`] = [];
                    }
                    identityMap[`${cluster}`].push(`${login}`);
                });
                identityMap[`${cluster}`].sort();
                // Persist mapping
                await vscode.workspace.getConfiguration('Kubi').update('identityMap', JSON.stringify(identityMap), vscode.ConfigurationTarget.Global);
                // If not advanced mode, remove logins already selected before recursing to next cluster
                if (!advancedMode) {
                    logins = logins.filter((el) => !choice.includes(el));
                }
                identityMapChoice(advancedMode, clusters, logins, identityMap);
            }
        });
    }
}

// Display kubi cluster endpoint in status bar after successful cnx
export function refreshStatusBar(kubiStatusChannel: vscode.StatusBarItem, endpoint: string) {
    let shortTxt: string = endpoint.replace(/.*\/\w+\./, ''); // cleaning endpoint by removing scheme and first word from url
    kubiStatusChannel.text = shortTxt;
    kubiStatusChannel.tooltip = `Kubi current used endpoint : ${shortTxt}`;
    kubiStatusChannel.show();
}

// Write directly in the KubeConfig file a new default context namespace 
export function updateKubeConfigNamespace(ns: string | undefined): Promise<string> {
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
export function testFavoritesNS(kubiOutputChannel: vscode.OutputChannel, favs: string[]): Promise<string[]> {
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
