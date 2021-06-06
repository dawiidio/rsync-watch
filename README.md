# rsync-watch

This lib was created because I needed a small helper for continuous syncing files
with a remote device, where remote connection could be defined in files per project.

# Installation

```bash
# globally, so you can use it from console anytime
npm i -g rsync-watch

yarn global add rsync-watch

#locally, so you can use it in project deps
npm i rsync-watch

yarn add rsync-watch
```

# Usage

Generate empty config file in current directory under the name `rsync.config.js`
```bash
rsync-watch -i
```

Start watching
```bash
rsync-watch
```

Pass custom config file
```bash
rsync-watch -c /home/user/custom.config.js
```

# Config file

Config file looks like below:

NOTE: if you want to exclude whole directory tree you need to specify `**/*` after it's name

```js
module.exports = {
    source: 'source-directory', // relative to directory where config is placed
    destination: '/home/user/', // destination directory on remote or local machine
    glob: '**/*', // glob for files which should be synced
    ignore: ['node_modules/**/*'], // array of string globs which exclude files/directories
    ssh: 'user@host' // optional ssh user and host if you sync with remote location
};
```

# Limitations
Mostly I'm running it while being in same directory as config file, so there are possible bugs with
wrong cwd in other cases. Also, for now it was tested only on macOS.

# Alternatives

- https://www.npmjs.com/package/watch-rsync
- https://www.npmjs.com/package/watch-and-rsync

### TODO

- [ ] maybe use this cli https://www.npmjs.com/package/rsync for rsync integration 
