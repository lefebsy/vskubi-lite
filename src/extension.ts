import * as vscode from 'vscode';
import * as child_process from "child_process";
import * as helpers from './helpers';
import * as k8s from 'vscode-kubernetes-tools-api';
import { LocalStorageService } from './localStorageService';

const kubiOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Kubi');
const kubiStatusChannel: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

//Main function
export async function activate(context: vscode.ExtensionContext) {

    //Initialize the global application state manager
    const state = new LocalStorageService(context.globalState);
    
    upgradeExtentionSettings(state);

    // Extend the Azure extension 'Kubernetes Explorer' with NetPol and Cagip VaultSecrets and some others
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("Policy", "Policies", "NetworkPolicy", "netpol").at("Network")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("Monitor", "Monitors", "ServiceMonitor", "ServiceMonitor").at("Network")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("VaultSecret", "VaultSecrets", "VaultSecret", "VaultSecret").at("Configuration")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("S3", "S3", "S3Bucket", "S3Bucket").at("Configuration")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("Quota", "Quotas", "ResourceQuota", "ResourceQuota").at("Configuration")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("AutoScaler", "AutoScalers", "HorizontalPodAutoscaler", "hpa").at("Workloads")
        );
        clusterExplorer.api.registerNodeContributor(
            clusterExplorer.api.nodeSources.resourceFolder("DisruptionBudget", "DisruptionBudgets", "PodDisruptionBudget", "pdb").at("Workloads")
        );
    }
    

    /**
     * Main function - Authentification :
     * 1) against kubi endpoint from kubeContext
     * 2) from sidePanel kubernetes cluster clik to 'Authenticate with Kubi'
     */
    let identity = vscode.commands.registerCommand('extension.vskubi-identity', (myClick) => {        
        if (myClick){
            helpers.getKubifromKubeContext(kubiOutputChannel, myClick.contextName).then( (kubiEndpoint) =>{
                authenticate(kubiEndpoint);
            });  
        }
        else {
            helpers.getKubifromKubeContext(kubiOutputChannel).then( (kubiEndpoint) =>{
                authenticate(kubiEndpoint);
            });    
        }
    });

    /**
     * Explain token from kubeConfig
     */
    let explain = vscode.commands.registerCommand('extension.vskubi-explain', async () => {
        const kubiPath:string = vscode.workspace.getConfiguration('Kubi').get('path','');  
        let kubiCommand=`${kubiPath} explain`;
        helpers.kubiVersion().then( (version) =>{
            if (version === 'nextgen'){
                child_process.exec(kubiCommand, (err, stdout) => {
                    //remove ansi color characters
                    stdout = stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,'');
                    if (err) {
                        kubiOutputChannel.appendLine('Kubi error detected :');
                        kubiOutputChannel.appendLine('\t' + `${err.message} ${stdout}`);
                        vscode.window.showErrorMessage(`Error ${err.message}  ${stdout}`, 'logs').then( (val)=>{
                            if (val==='logs') { kubiOutputChannel.show(); }
                        });
                        return;
                    }
                    if (stdout) {
                        kubiOutputChannel.appendLine('');
                        kubiOutputChannel.appendLine('\t' + `${stdout}`);
                        vscode.window.showInformationMessage("Look at your kubi output channel");
                        kubiOutputChannel.show();
                    }
                });                
            }
            else {
                vscode.window.showInformationMessage("Your cli kubi version is too old for this command");
            }
        });
    });


    /**
     * Map logins to clusters
     */
    let identityMap = vscode.commands.registerCommand('extension.vskubi-id-map', async () => {
        // retrieve user settings
        const kubiEndpointList = <string>vscode.workspace.getConfiguration('Kubi').get('clusters');
        const kubiLogin = <string>vscode.workspace.getConfiguration('Kubi').get('logins','');
        let logins = kubiLogin.split(',');
        let clusters = kubiEndpointList.split(',');
        
        // quick fail
        if (!kubiEndpointList) { return; }
        if (clusters.length === 1) { return; }
        if (logins.length === 1) { return; }
        helpers.identityMapChoice(clusters,logins,JSON.parse('{}'));
    });

    /**
     * Retrieve in user settings a comma separated list of kubi-url cluster to display a picking list.
     */
    let defaultCluster = vscode.commands.registerCommand('extension.vskubi-default-cluster', async () => {
        const kubiEndpointList = <string>vscode.workspace.getConfiguration('Kubi').get('clusters');
        if (kubiEndpointList) {
            let list = kubiEndpointList.split(',');
            let kubiEndpoint = await vscode.window.showQuickPick(list, { placeHolder: 'Select the default cluster' });
            if (kubiEndpoint) {
                authenticate(kubiEndpoint);
            }
        }
    });

    /**
     * Retrieve in user settings a comma separated list of favorites namespaces to display a picking list.
     */
    let switchDefaultNamespace = vscode.commands.registerCommand('extension.vskubi-set-namespace', async () => {
        const kubiNamespaceList = <string>vscode.workspace.getConfiguration('Kubi').get('favoritesNamespaces');
        if (kubiNamespaceList) {
            let userFavsList = kubiNamespaceList.split(',');
            let updatedFavsList = await helpers.testFavoritesNS(kubiOutputChannel, userFavsList);
            let msgHolder = (updatedFavsList.length === 0) ? 'Sorry no favorites namespace found' : 'Select new default namespace';
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
        else {
            vscode.window.showWarningMessage('No favorites namespace in settings');
        }
    });

    context.subscriptions.push(identity);
    context.subscriptions.push(identityMap);
    context.subscriptions.push(defaultCluster);
    context.subscriptions.push(switchDefaultNamespace);
    context.subscriptions.push(explain);

}

/**
 * Core function of this extension
 * @param kubiEndpoint kubi endpoint value
 */
export function authenticate(kubiEndpoint:string) {
    helpers.askLogin(kubiEndpoint).then((kubiLogin?:string|undefined) => {
        // quit if no login
        if (!kubiLogin) { return; }

        vscode.window.showInputBox({
                prompt: "Password ?",
                placeHolder: "Please type your password",
                password: true,
                ignoreFocusOut: true,
            }).then((kubiPwd?: string) => {

            // quit if no password entered
            if (!kubiPwd) { return; }

            // forging command to launch kubi, and one dispayed without password for debug
            helpers.kubiForge(kubiLogin, kubiPwd, kubiEndpoint, kubiOutputChannel).then( (kubiCommand => {
                // spawning child processus (kubi-cli itself)
                child_process.exec(kubiCommand, (err, stdout) => {
                    //remove ansi color characters
                    stdout = stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,'');
                    if (err) {
                        kubiOutputChannel.appendLine('Kubi error detected :');
                        kubiOutputChannel.appendLine('\t' + `${kubiEndpoint} with ${kubiLogin} : ${stdout}`);
                        helpers.refreshStatusBar(kubiStatusChannel, `${kubiEndpoint} - failed`);
                        vscode.window.showErrorMessage(`${kubiLogin} : ${stdout} - Response from '${kubiEndpoint}'`, 'logs').then( (val)=>{
                            if (val==='logs') { kubiOutputChannel.show(); }
                        });
                    }
                    else {
                        if (stdout) {
                            vscode.window.showInformationMessage(stdout);
                            helpers.refreshStatusBar(kubiStatusChannel, `${kubiEndpoint}`);                            
                            // kube config updated by kubi, need to set context to newly refreshed cluster config
                            helpers.setKubeContext(kubiOutputChannel,kubiLogin,kubiEndpoint).finally( ()=>{
                                // after a kubi generation the default namespace is always 'default', so if favorites are defined :switch
                                if (vscode.workspace.getConfiguration('Kubi').get('favoritesNamespaces')) {
                                    vscode.commands.executeCommand('extension.vskubi-set-namespace');
                                }
                                else {
                                    // even without favorites namespace, still usefull to refresh view
                                    vscode.commands.executeCommand('workbench.view.extension.kubernetesView'); // focus on kube view
                                    vscode.commands.executeCommand('extension.vsKubernetesRefreshExplorer'); // ask a refresh to extension kubernetes explorer view
                                }
                            });
                        }
                    }
                });
            }));
        });
    });
}

/**
 * handling new names of settings
 * @param state extension global persited state (not user settings)
 */
export async function upgradeExtentionSettings(state: LocalStorageService) {   
    let versionSettings = state.getValue<string>('versionSettings','old');

    //old -> 1.4.0 upgrade
    if (versionSettings==='old') {

        // login -> logins
        let login = vscode.workspace.getConfiguration('Kubi').get('login');
        if (login){
            await vscode.workspace.getConfiguration('Kubi').update('logins', login, vscode.ConfigurationTarget.Global);
        }
        // endpoint-list -> clusters
        let endpointList = vscode.workspace.getConfiguration('Kubi').get('endpoint-list');
        if (endpointList){
            await vscode.workspace.getConfiguration('Kubi').update('clusters', endpointList, vscode.ConfigurationTarget.Global);
        }
        // favoriteNamespaces -> favoritesNamespaces
        let favorites = vscode.workspace.getConfiguration('Kubi').get('favoriteNamespaces');
        if (favorites){
            await vscode.workspace.getConfiguration('Kubi').update('favoritesNamespaces', favorites, vscode.ConfigurationTarget.Global);
        }
        // extra -> parameters
        let extra = vscode.workspace.getConfiguration('Kubi').get('extraParameters');
        if (extra){
            await vscode.workspace.getConfiguration('Kubi').update('parameters', extra, vscode.ConfigurationTarget.Global);
        }
        // identityMap:string -> mapID:object
        let imap:string = vscode.workspace.getConfiguration('Kubi').get('identityMap','{}');
        if (imap){
            await vscode.workspace.getConfiguration('Kubi').update('mapID', JSON.parse(imap), vscode.ConfigurationTarget.Global);
        }
        
        state.setValue<string>('versionSettings', '1.4.0');
    }
    if (versionSettings==='1.4.0') {
        // extra -> parameters
        let extra = vscode.workspace.getConfiguration('Kubi').get('extraParameters');
        if (extra){
            await vscode.workspace.getConfiguration('Kubi').update('parameters', extra, vscode.ConfigurationTarget.Global);
        }        
        state.setValue<string>('versionSettings', '1.4.1');
    }
}

export function deactivate() {
    // This is intentional override function, please Sonar, be kind
}