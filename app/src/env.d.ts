/// <reference types="vite/client" />
declare module 'vite-plugin-node-polyfills/shims/process' {
  const process: NodeJS.Process
  export default process
}
