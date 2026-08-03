# Build and run the PolicyForge MCP server over stdio.
#
# The server talks MCP on stdout, so nothing else may be written there — npm's
# own output would corrupt the stream, which is why the runtime stage invokes
# node directly rather than `npm start`.
#
#   docker build -t policyforge-mcp .
#   docker run --rm -i -e POLICYFORGE_API_KEY=pf_… policyforge-mcp
#
# The key is optional at startup: without it the server still lists its tools,
# and every tool call returns a 401 explaining how to set one.

FROM node:22-alpine AS build
WORKDIR /app

# Install against the lockfile first so the dependency layer survives source edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies — tsc and @types are not needed to run.
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER node
ENTRYPOINT ["node", "dist/index.js"]
