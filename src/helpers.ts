import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as fs from 'fs';
import * as path from 'path';
import * as yml from 'js-yaml';


/**
 * Retrieve login from settings or ask user from mapped ones
 * @param kubiEndpoint kubi endpoint value
 */
export async function askLogin(kubiEndpoint: string): Promise<string | undefined> {
    const identityMap: Record<string, Array<string>> = vscode.workspace.getConfiguration('Kubi').get('mapID', JSON.parse('{}'));
    const kubiLogin: string = vscode.workspace.getConfiguration('Kubi').get('logins', '');

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
            vscode.commands.executeCommand('extension.vskubi-id-map');
            return undefined;
        }
    }

    // if only one login is mapped to this cluster
    if (identityMap[<any>kubiEndpoint].length === 1) {
        return identityMap[<any>kubiEndpoint][0];
    }

    // logins are defined for the cluster, let human select one
    return vscode.window.showQuickPick(identityMap[<any>kubiEndpoint], { placeHolder: 'Select your login' });

}

/**
 * Recursive function to display pickinglist about logins mapped to clusters
 * @param clusters 
 * @param logins 
 * @param identityMap 
 */
export function identityMapChoice(clusters: string[], logins: string[], identityMap: Record<string, Array<string>> | undefined) {
    const advancedMode = <boolean>vscode.workspace.getConfiguration('Kubi').get('advancedMode');
    if (identityMap && logins.length >= 1 && clusters.length >= 1) {
        let login = logins.shift(); //pick first login and remove it from the list
        vscode.window.showQuickPick(clusters, { canPickMany: true, placeHolder: `Select cluster(s) to use with : ${login}` }).then(async (choice) => {
            if (choice) {
                choice.forEach(cluster => {
                    // need to initialyse with an empty array before pushing a login
                    if (!identityMap[`${cluster}`] || identityMap[`${cluster}`].length === 0) {
                        identityMap[`${cluster}`] = [];
                    }
                    identityMap[`${cluster}`].push(`${login}`);
                    identityMap[`${cluster}`].sort();
                });
                // Persist mapping
                await vscode.workspace.getConfiguration('Kubi').update('mapID', identityMap, vscode.ConfigurationTarget.Global);
                // If not advanced mode, remove clusters already selected before recursing to next login
                if (!advancedMode) {
                    clusters = clusters.filter((el) => !choice.includes(el));
                }
                identityMapChoice(clusters, logins, identityMap);
            }
        });
    }
}

/**
 * Display kubi cluster endpoint in status bar after successful cnx
 * @param kubiStatusChannel extension log channel
 * @param endpoint kubi endpoint value
 */
export function refreshStatusBar(kubiStatusChannel: vscode.StatusBarItem, endpoint: string) {
    let shortTxt: string = endpoint.replace(/.*\/\w+\./, ''); // cleaning endpoint by removing scheme and first word from url
    kubiStatusChannel.text = shortTxt;
    kubiStatusChannel.tooltip = `Kubi current used endpoint : ${shortTxt}`;
    kubiStatusChannel.show();
}

/**
 * Get Kubectl path from vsKubernetes settings
 */
export function kctl(): string {
    let kubectlPath = vscode.workspace.getConfiguration('vscode-kubernetes')['kubectl-path'];

    // old way kubernetes extension storing settings
    let legacy_kubectlPath = vscode.workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.kubectl-path'];

    return kubectlPath || legacy_kubectlPath || 'kubectl path not found, set it in kubernetes extension please';
}

/**
 * Write directly in the KubeConfig file a new default context namespace
 * @param ns namespace name
 */
export function updateKubeConfigNamespace(ns: string | undefined): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const config = path.join(require('os').homedir(), ".kube", "config").normalize();
        fs.readFile(config, { encoding: 'utf-8' }, (readErr, data) => {
            if (readErr) {
                reject(readErr.message);
                return;
            }

            // load and parse yaml kubeConfig file data
            const doc: object = <object>yml.safeLoad(data);
            if (!doc) {
                reject(`${config} is not a valid yaml file`);
                return;
            }


            /**
             *find in the contexts the one with the name attribute value matching the 'current-context' value
            */ 

            let currentContextName = Object.entries(doc).find((value, index, obj) => {
                return (value[0] ==='current-context');
            })?.[1];


            let contexts = <[string|any]>Object.entries(doc).find((value, index, obj) => {
                return (value[0] ==='contexts');
            })?.[1];

            let theContext = contexts?.find((value, index, obj) => {
                return (value?.name === currentContextName);
            });
            

            // set the wanted namespace value in the current context
            theContext.context.namespace = ns;

            // write changes to file
            fs.writeFile(config, yml.safeDump(doc), (writeErr) => {
                if (writeErr) {
                    reject(`couldn't update ${config}: ${writeErr.message}`);
                    return;
                }
                resolve();
            });

        });
    });
}


/**
 * Test each namespace retrieved from kube api server against user fovorites
 * partial match available : ['sys','pub'] will return ['kube-public','kube-system']
 * @param kubiOutputChannel extension log channel
 * @param favs favorites namespaces list
 */
export function testFavoritesNS(kubiOutputChannel: vscode.OutputChannel, favs: string[]): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
        // default return array
        const matchingNamespaces: (string | string[])[] = [];

        // get kubectl form microsoft kubernetes extension
        const kubectlPath = kctl();
        let cmd = `${kubectlPath} get ns -o json`;
        // spawning child processus (kubi-cli itself)
        child_process.exec(cmd, (err, stdout) => {
            if (err) {
                kubiOutputChannel.appendLine('');
                kubiOutputChannel.appendLine(new Date().toLocaleString());
                kubiOutputChannel.appendLine('Command generated :');
                kubiOutputChannel.appendLine('\t' + cmd);
                kubiOutputChannel.appendLine('Error detected :');
                kubiOutputChannel.appendLine('\t' + `${kubectlPath} : ${stdout} ${err}`);
                vscode.window.showErrorMessage(`${kubectlPath} : ${stdout} ${err}`, 'logs').then((val) => {
                    if (val === 'logs') { kubiOutputChannel.show(); }
                });
            }
            else {
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
                    }
                }
            }
        });


    });
}

/**
 * Build the command line depending Kubi version [command,command4Debug]
 * @param kubiLogin kubi login value
 * @param kubiPwd  kubi password value
 * @param kubiEndpoint kubi endpoint value
 * @param kubiOutputChannel extension log channel
 */
export function kubiForge(kubiLogin: string, kubiPwd: string, kubiEndpoint: string, kubiOutputChannel: vscode.OutputChannel): Promise<string> {
    return new Promise<string>((resolve) => {
        const kubiPath: string = vscode.workspace.getConfiguration('Kubi').get('path', '');
        const kubiExtra: string = vscode.workspace.getConfiguration('Kubi').get('parameters', '');
        kubiVersion().then((version) => {
            let kubiCommand4Debug;
            if (version === 'firstgen') {
                kubiCommand4Debug = `${kubiPath} --username ${kubiLogin} --kubi-url ${kubiEndpoint} --generate-config ${kubiExtra}`;
                resolve(`${kubiPath} --username ${kubiLogin} --password ${kubiPwd} --kubi-url ${kubiEndpoint} --generate-config ${kubiExtra}`);
            }
            else {
                kubiCommand4Debug = `${kubiPath} config --username ${kubiLogin} --kubi-url ${kubiEndpoint} ${kubiExtra}`;
                resolve(`${kubiPath} config --username ${kubiLogin} --password ${kubiPwd} --kubi-url ${kubiEndpoint} ${kubiExtra}`);
            }
            //log generated command(without password)
            kubiOutputChannel.appendLine('');
            kubiOutputChannel.appendLine(new Date().toLocaleString());
            kubiOutputChannel.appendLine('Command generated :');
            kubiOutputChannel.appendLine('\t' + kubiCommand4Debug);
        });
    });
}

/**
 * Detect kubi version
 */
export function kubiVersion(): Promise<string> {
    return new Promise<string>((resolve) => {
        const kubiPath = vscode.workspace.getConfiguration('Kubi').get('path');
        let v: string;
        child_process.exec(`${kubiPath} version`, (err, stdout) => {
            if (err) {
                //FirstGeneration kubi without version command
                resolve('firstgen');
                vscode.window.showWarningMessage('Old version detected. Please upgrade Cagip Kubi cli >=v1.8.3 - https://github.com/ca-gip/kubi/releases');
                return;
            }
            if (stdout) {
                resolve('nextgen');
            }
        });
    });
}


/**
 * Set current context in kubeconfig.
 * Return true if succeed, false if failing
 * @param kubiOutputChannel extension log channel
 * @param login login value
 * @param endpoint kubi endpoint value
 */
export function setKubeContext(kubiOutputChannel: vscode.OutputChannel, login: string, endpoint: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {

        let clusterName = endpoint.substring(endpoint.indexOf('.') + 1, endpoint.length);
        let contextName = `${login}_${clusterName}`;
        let kubectlPath = kctl();
        let cmd = `${kubectlPath} config use-context ${contextName}`;

        // spawning child processus (kubi-cli itself)
        child_process.exec(cmd, (err, stdout) => {
            if (err) {
                kubiOutputChannel.appendLine('');
                kubiOutputChannel.appendLine(new Date().toLocaleString());
                kubiOutputChannel.appendLine('\t' + cmd);
                kubiOutputChannel.appendLine('Error detected :');
                kubiOutputChannel.appendLine('\t' + `${kubectlPath} : ${err.message}`);
                vscode.window.showErrorMessage(`${kubectlPath} : ${err.message}`, 'logs').then((val) => {
                    if (val === 'logs') { kubiOutputChannel.show(); }
                });
                reject(false);
                return;
            }
            if (stdout) {
                resolve(true);
            }
        });
    });
}


/**
 * Get kubi endpoint for 
 * - the kubeconfig current context name
 * OR
 * - cluster name right-clicked in Microsoft Kubernetes sidePanel clusters list
 * @param kubiOutputChannel extension log channel
 * @param fromClick [optionnal] cluster name from cluster's right-clicked 'Microsoft Kubernetes' sidePanel clusters list
 */
export function getKubifromKubeContext(kubiOutputChannel: vscode.OutputChannel, fromClick?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const kubectlPath = kctl();
        let cmd = `${kubectlPath} config current-context`;

        if (fromClick) {
            let clicked = matchKubifromKubeContext(fromClick);
            if (clicked === '') {
                reject('');
            }
            else {
                resolve(clicked);
            }
        }
        else {
            // spawning child processus (kubi-cli itself)
            child_process.exec(cmd, (err, stdout) => {
                if (err) {
                    kubiOutputChannel.appendLine('');
                    kubiOutputChannel.appendLine(new Date().toLocaleString());
                    kubiOutputChannel.appendLine('\t' + cmd);
                    kubiOutputChannel.appendLine('Error detected :');
                    kubiOutputChannel.appendLine('\t' + `${kubectlPath} : ${err.message}`);
                    vscode.window.showErrorMessage(`${kubectlPath} : ${err.message}`, 'logs').then((val) => {
                        if (val === 'logs') { kubiOutputChannel.show(); }
                    });
                    reject('');
                    return;
                }
                if (stdout) {
                    stdout = stdout.replace('\n', ''); //cleaning stdout
                    let current = matchKubifromKubeContext(stdout);
                    if (current === '') {
                        reject('');
                    }
                    else {
                        resolve(current);
                    }
                }
            });
        }
    });
}

/**
 * Try to find kubi endpoint inside setting list matching the kubeConfig current context name
 * @param clusterName kubernetes cluster name (from currentContext or rightClicked on Kubernetes extension clusters list)
 */
export function matchKubifromKubeContext(clusterName: string): string {
    const endpoints = <string>vscode.workspace.getConfiguration('Kubi').get('clusters', '');
    let cluster = clusterName.substring(clusterName.indexOf('_') + 1, clusterName.length); //remove context prefix 'login_'
    //find kubi endpoint matching current context cluster
    let filtered: string[] = endpoints.split(',').filter((value: string, index: number, array: string[]) => {
        return (value.includes(cluster));
    });
    if (filtered.toString() === '') {
        vscode.window.showWarningMessage(`Not matching any endpoint of clusters list`);
        vscode.commands.executeCommand('extension.vskubi-default-cluster');
    }
    return filtered.toString();
}