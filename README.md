decentral.fm
============

**Requirements:** node, mongodb

## Quick Start

```bash
git clone git@github.com:martindale/maki.git
cd maki
npm install
npm link
cd ..
git clone git@github.com:martindale/decentral.fm.git
cd decentral.fm
npm install
npm link maki
nodemon decentral.js
```

You should now be able to edit ``./decentral.fm/decentral.js` for Resource changes, and `./maki` for general behavior changes.
