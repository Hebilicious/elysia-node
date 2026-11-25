if ('Bun' in globalThis) {
  throw new Error('❌ Use Node.js to run this test!');
}

import { Elysia } from 'elysia';
import { node } from '@elysiajs/node';

let stopHookCalls = 0;

const app = new Elysia({ adapter: node() })
  .onStop(() => {
    stopHookCalls++;
  })
  .get('/', () => 'hi')
  // A response that never ends, like an SSE stream.
  .get(
    '/stream',
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('open'));
          }
        })
      )
  )
  .listen(0);

if (!app.server) {
  throw new Error('❌ app.server is not set after listen');
}

const server = app.server.raw;
await server.ready();

if ((await fetch(server.url).then((response) => response.text())) !== 'hi') {
  throw new Error('❌ The server does not answer');
}

const stream = await fetch(new URL('/stream', server.url));
await stream.body.getReader().read();

// Without `closeActiveConnections`, `stop` waits for the stream to end.
const hang = setTimeout(() => {
  console.error('❌ app.stop(true) does not close the open stream');
  process.exit(1);
}, 5000);
await app.stop(true);
clearTimeout(hang);

if (app.server) {
  throw new Error('❌ app.server is not reset after stop');
}

if (await fetch(server.url).then(() => true, () => false)) {
  throw new Error('❌ The server still answers after stop');
}

process.emit('beforeExit', 0);

if (stopHookCalls !== 1) {
  throw new Error(`❌ The stop hooks ran ${stopHookCalls} times, expected 1`);
}

console.log('✅ app.stop(true) stops the server');
