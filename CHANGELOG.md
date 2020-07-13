# Change Log

All notable changes to the "vskubi-lite" extension will be documented in this file.

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

- Favorite namespaces : replace k8s client bugged with proxy by a kubectl call (using Microsoft Kunernetes path setting)

## 1.0.3

- Fix logs and async promises

## 1.0.2

- Fix stuffs for windows

## 1.0.1

- Fix TravisCI and bump some dependencies

## 1.0.0

- New feature : __favorite namespaces__
  - User favorite are checked, autocompleted and sorted from kube server api. Partial matches are available. Your fav list `"sys,pub"` will return `["kube-public","kube-system"]`

## 0.3.0

- New feature : __Shortcut Default Cluster__
  - Changing kubi endpoint `[Ctrl+k Ctrl+d]`, launch authentication then propose favorite namespaces and refresh Kubernetes `'explorer view'`

## 0.2.1

- Fix dependency tree with sonar tips

## 0.2.0

- New feature :
  - Display a list of favorite namespaces and easily refresh Kubernetes extention 'explorer view' `[Ctrl+k Ctrl+n]`
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
