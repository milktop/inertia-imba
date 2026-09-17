# Public API declarations

Consumers previously received untyped imports for the adapter's JavaScript
helpers. Added .d.ts declarations and package `types` export conditions for the
root, form, and http entrypoints. Runtime entrypoints and method names are unchanged.

Form fields retain their inferred types. Precognition methods and bound submit
are exposed only when actually available. HTTP methods retain their promise/JSON
semantics. Errors allow strings or arrays to match Rails and the validation
helpers; unsupported options are deliberately absent.

The API guide records supported behavior and differences. Type fixtures exercise
package import resolution, valid calls, incorrect fields, unsupported features,
and checked JavaScript. `npm run test:types` runs in CI with strict checks and
Vite-style Bundler resolution. Imba language-extension completion remains outside
this verification; the declarations primarily cover TypeScript/JSDoc consumers.

Follow-up: nested persistent layouts and SSR remain separate features. Update the
declarations, guide, type examples, and runtime tests together as APIs expand.
