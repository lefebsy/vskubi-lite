# __VSCode__ Kubi-Lite extension compatible with __Theia IDE__

[![Build Status](https://travis-ci.com/lefebsy/vskubi-lite.svg?branch=master)](https://travis-ci.com/lefebsy/vskubi-lite)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lefebsy_vskubi-lite&metric=alert_status)](https://sonarcloud.io/dashboard?id=lefebsy_vskubi-lite)

__Kubi CLI__ is provided by CA-GIP at <https://github.com/ca-gip/kubi>.
This extension is a GUI wrapper compatible vith __VSCode__ and __Theia IDE__.

## Getting started

1. Download __Kubi CLI__ and add it to your path, or set the absolute path in the __Kubi-lite__ settings
2. Set preferences in VSCode settings
3. Use `ctrl+k ctrl+i` to invoke the generation of the KubeConfig in your `$HOME`.

## Bonus

- Your list of favorite namespaces are checked, autocompleted and sorted from kube server api. Partial matches are available. Your fav list `"sys,pub"` will return `["kube-public","kube-system"]`.
Then your kubernetes extension 'explorer view' is refreshed :-)
- Easy switch between a kube cluster or another througth a simple list of kubi endpoint servers...  

## Visual settings & integration with Kubernetes extension

- Integration with : <https://github.com/Azure/vscode-kubernetes-tools>
- The command is added on the contextuals menus hover the "clusters view"
![screencast](DemoHelp.gif)

## Theia IDE

1. From VSCode marketplace or GitHub release, download the package extension `.vsix` to your Theia `Plugins repository`
2. Set your keyBinding
3. That's all ;-)
![screencast](DemoTheia.gif)

## License

- The code is licensed under the [MIT license](http://choosealicense.com/licenses/mit/). See [LICENSE](LICENSE).
- Logo is CA-GIP/Kubi logo : <https://github.com/ca-gip/kubi>
