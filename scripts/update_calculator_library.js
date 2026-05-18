const fs = require('fs');
const path = require('path');

const originalBase = 'd:\\e7tracker\\epic7-damage-calc\\damage-calc';
const destBase = 'd:\\e7tracker\\e7tracker\\src\\services\\damageCalc\\original';

const filesToCopy = [
  'src/app/models/hero.ts',
  'src/app/models/target.ts',
  'src/app/models/artifact.ts',
  'src/app/models/skill.ts',
  'src/app/models/forms.ts',
  'src/app/models/languages.ts',
  'src/app/models/attack-presets.ts',
  'src/app/models/target-presets.ts',
  'src/app/services/damage.service.ts',
  'src/app/services/data.service.ts',
  'src/assets/data/heroes.ts',
  'src/assets/data/artifacts.ts',
  'src/assets/data/constants.ts'
];

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Clean destination directory if it exists to ensure no stale files
if (fs.existsSync(destBase)) {
  fs.rmSync(destBase, { recursive: true, force: true });
}

for (const relPath of filesToCopy) {
  const srcFile = path.join(originalBase, relPath);
  const destFile = path.join(destBase, relPath);

  ensureDirectoryExistence(destFile);

  let content = fs.readFileSync(srcFile, 'utf8');

  // Stub @angular/core
  content = content.replace(/import\s+{[^}]+}\s+from\s+['"]@angular\/core['"];?/g, `
    export const Injectable = () => () => {};
    export class EventEmitter {
      listeners = [];
      emit(value) { this.listeners.forEach(cb => cb(value)); }
      subscribe(cb) { this.listeners.push(cb); return { unsubscribe() { this.listeners = this.listeners.filter(l => l !== cb); } }; }
    }
  `);

  // Stub @angular/router
  content = content.replace(/import\s+{[^}]+}\s+from\s+['"]@angular\/router['"];?/g, `
    export class Router {}
    export class ActivatedRoute {
      snapshot = { paramMap: { get() { return 'us'; } } };
      queryParams = { subscribe(cb) { cb({}); } };
    }
  `);

  // Stub rxjs
  content = content.replace(/import\s+{[^}]+}\s+from\s+['"]rxjs['"];?/g, `
    export class BehaviorSubject {
      value;
      listeners = [];
      constructor(val) { this.value = val; }
      next(val) { this.value = val; this.listeners.forEach(cb => cb(val)); }
      subscribe(cb) { cb(this.value); this.listeners.push(cb); return { unsubscribe() { this.listeners = this.listeners.filter(l => l !== cb); } }; }
    }
  `);

  // Convert absolute imports to relative imports
  // Determine file depth relative to "src/"
  const parts = relPath.split('/');
  const depth = parts.length - 2; // depth from src folder (e.g. src/app/models/hero.ts has parts length 4, so depth is 2)
  const relativePrefix = '../'.repeat(depth);

  // Replace 'src/app/' with relativePrefix + 'app/'
  content = content.replace(/(from\s+['"])src\/app\//g, `$1${relativePrefix}app/`);
  // Replace 'src/assets/' with relativePrefix + 'assets/'
  content = content.replace(/(from\s+['"])src\/assets\//g, `$1${relativePrefix}assets/`);

  // Angular translation pipe and extra service stubs
  content = content.replace(/import\s+{\s*TranslationPipe\s*}\s+from\s+['"][^'"]+['"];?/g, 'export const TranslationPipe = class { transform(x) { return x; } };');
  content = content.replace(/import\s+{\s*LanguageService\s*}\s+from\s+['"][^'"]+['"];?/g, 'export const LanguageService = class {};');
  content = content.replace(/import\s+{\s*GoogleTagManagerService\s*}\s+from\s+['"][^'"]+['"];?/g, 'export const GoogleTagManagerService = class {};');

  fs.writeFileSync(destFile, content, 'utf8');
}

console.log('Original E7 Damage Calculator library files successfully imported and stubbed under src/services/damageCalc/original/');
