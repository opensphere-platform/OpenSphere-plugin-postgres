FROM docker.io/library/node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2
ARG OS_MODULE_DESCRIPTOR
ARG OS_MODULE_SIGNATURE
ARG OS_RELEASE_TAG
ARG OS_SOURCE_REVISION
ARG OS_MODULE_KEY_ID=opensphere-edge-local-v1
LABEL org.opencontainers.image.title="OpenSphere PostgreSQL Plugin" \
      org.opencontainers.image.version=$OS_RELEASE_TAG \
      org.opencontainers.image.revision=$OS_SOURCE_REVISION \
      org.opencontainers.image.source="https://github.com/opensphere-platform/OpenSphere-plugin-postgres" \
      io.opensphere.channel="edge" \
      io.opensphere.compatibility-version="0.1.1" \
      io.opensphere.foundation.plugin-id="postgres" \
      io.opensphere.image-platform="linux/amd64" \
      io.opensphere.module.descriptor=$OS_MODULE_DESCRIPTOR \
      io.opensphere.module.descriptor.signature=$OS_MODULE_SIGNATURE \
      io.opensphere.module.descriptor.key-id=$OS_MODULE_KEY_ID \
      io.opensphere.release-tag=$OS_RELEASE_TAG \
      io.opensphere.source-revision=$OS_SOURCE_REVISION \
      opensphere.io/build-authority="localhost" \
      opensphere.io/ga-eligible="false" \
      opensphere.io/release-class="pre-ga"
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
ENV PORT=8080 PLUGIN_DIR=/plugins APP_VERSION=0.1.1
WORKDIR /app
COPY server.js /app/server.js
COPY dist/postgres/browser/main.js /plugins/main.js
COPY dist/postgres/browser/styles.css /plugins/styles.css
COPY docs/postgresql-operations.ko.md /plugins/postgresql-operations.ko.md
COPY ui-shell/ui-shell.manifest.json ui-shell/ui-shell.manifest.json.sig /plugins/
COPY module-package.json module-package.json.sig /plugins/
EXPOSE 8080
USER node
CMD ["node", "/app/server.js"]
