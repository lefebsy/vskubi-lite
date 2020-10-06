FROM gitpod/workspace-full
RUN curl -sLO https://storage.googleapis.com/kubernetes-release/release/v1.17.8/bin/linux/amd64/kubectl \
    && chmod +x ./kubectl \
    && sudo mv ./kubectl /usr/local/bin/kubectl
RUN curl -sLO https://github.com/ca-gip/kubi/releases/download/v1.8.5/kubi \
    && chmod +x ./kubi \
    && sudo mv ./kubi /usr/local/bin/kubi

# More information: https://www.gitpod.io/docs/config-docker/