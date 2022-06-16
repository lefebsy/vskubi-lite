# Change Log

All notable changes to the "vskubi-lite" extension will be documented in this file.

## 1.4.7
- Fix security

## 1.4.6
- Fix security

## 1.4.5
- Fix security

## 1.4.4
- Fix security

## 1.4.3
- Fix some bugs

## 1.4.2
- Fix some bugs

## 1.4.1
- Fix some bugs

## 1.4.0
- Cagip Kubi >= v1.8.3 compatible
- New main features :
  - __Kubi Explain__ : get detailed information about token `[ctrl k + ctrl e]` - *need Kubi >= v1.8.3*
  - __Multiple Config__ : KubeConfig with many clusters - *need Kubi >= v1.8.3* 
  - __Extend Kubernetes Explorer__ :
    - Display resources : *S3Bucket, VaultSecret, NetworkPolicy, ServiceMonitor, ResourceQuota, HorizontalPodAutoscaler, PodDisruptionBudget*
    - Right click menu on each cluster on sidePanel list to get a new token
- Modifications :
  - Refactoring settings and functions naming

## 1.3.2
- Fix CVE-2020-7720 and CVE-2020-7660

## 1.3.1

- Publish Kubi-lite on Theia Open VSX registry https://open-vsx.org/extension/lefebsy/vskubi-lite
- Update Travis CI to publish on OpenVSX registry

## 1.3.0

- New alpha feature : __Extend Kubernetes Explorer__
  - Use [Azure Kubernetes Tools API](https://github.com/Azure/vscode-kubernetes-tools) to add resources `NetworkPolicy` and `Cagip VaultSecret` support in explorer GUI

## 1.2.1

- Fix defaulting value in settings
- Fix UX : identityMapping behavior modified, there is usally more clusters than logins :-)

## 1.2.0

- New feature : __Advanced mode__
  - new checkbox in settings. Check it to change the behavior of `IdentityMap`
  - Allow to map many logins to many clusters `[ctrl Shift k + ctrl Shift i]`
- Security fix
  - Bump a lot of dependencies
- TravisCI evolution

## 1.1.0

- New feature : __Support many clusters__
  - when you need to switch between many clusters
  - Allow to use different logins on your clusters
    - __IdentityMap__ : `[Ctrl Shift k + Ctrl Shift i]`

## 1.0.4

- Favorites namespaces : replace k8s client bugged with proxy by a kubectl call (using Microsoft Kunernetes path setting)

## 1.0.3

- Fix logs and async promises

## 1.0.2

- Fix stuffs for windows

## 1.0.1

- Fix TravisCI and bump some dependencies

## 1.0.0

- New feature : __favorites namespaces__
  - User favorites are checked, autocompleted and sorted from kube server api. Partial matches are available. Your fav list `"sys,pub"` will return `["kube-public","kube-system"]`

## 0.3.0

- New feature : __Shortcut Default Cluster__
  - Changing kubi endpoint `[Ctrl+k Ctrl+d]`, launch authentication then propose favorites namespaces and refresh Kubernetes `'explorer view'`

## 0.2.1

- Fix dependency tree with sonar tips

## 0.2.0

- New feature :
  - Display a list of favorites namespaces and easily refresh Kubernetes extention 'explorer view' `[Ctrl+k Ctrl+n]`
- Fix RegExp groups complexity to avoid CVE-2017-16021 and CVE-2018-13863

## 0.1.2

- Add a statusBar information
- Bump VSCode dependency version to be compliant with workspace settings

## 0.1.1

- Contextual menu fixes

## 0.1.0

- New features :
  - Display a list of kubi endpoints to easily switch between clusters `[Ctrl+k Ctrl+d]`
  - Add token in `clipboard` when using `generate-token` action

## 0.0.5

- Fix CVE-2019-16769 on dev dependency

## 0.0.4

- Fix extra arguments position

## 0.0.3

- CI :
  - Sonar and Travis integration for better quality

## 0.0.2

- Some fixes and new option to use the token generation

## 0.0.1

- Initial release - LIte version from VSKubi, compatible Theia
