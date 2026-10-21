FROM node:24-bookworm-slim

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
# Optional trusted CA for builds behind a corporate/cloud HTTPS proxy.
# The certificate mount is ephemeral and is not included in the final image.
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund

COPY --chown=node:node *.js ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /var/lib/supernet /backups && chown node:node /var/lib/supernet /backups

ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/var/lib/supernet
USER node
VOLUME ["/var/lib/supernet", "/backups"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
