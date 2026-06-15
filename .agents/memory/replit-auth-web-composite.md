---
name: replit-auth-web composite tsconfig
description: lib/replit-auth-web requires composite:true in tsconfig to avoid TS6306 when referenced by artifact packages.
---

lib/replit-auth-web/tsconfig.json must have:
```json
{
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    ...
  }
}
```

Also must be listed in root tsconfig.json references array and in artifacts/onechat/tsconfig.json references.

**Why:** TypeScript project references require referenced projects to be composite (emit declarations). Without this, tsc throws TS6306: "Referenced project must have setting composite: true."

**How to apply:** Any new lib/* package that is referenced by an artifact tsconfig must have composite + declarationMap + emitDeclarationOnly in its tsconfig. Also: do NOT use import.meta.env in lib packages — they don't have vite/client types and it causes TS2339.
