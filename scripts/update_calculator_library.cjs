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
  'src/app/services/language.service.ts',
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

// Clean destination directory if it exists to ensure no stale files (except our own angular_stubs.ts)
if (fs.existsSync(destBase)) {
  const stubFile = path.join(destBase, 'src/app/services/angular_stubs.ts');
  let stubContent = '';
  if (fs.existsSync(stubFile)) {
    stubContent = fs.readFileSync(stubFile, 'utf8');
  }
  fs.rmSync(destBase, { recursive: true, force: true });
  if (stubContent) {
    ensureDirectoryExistence(stubFile);
    fs.writeFileSync(stubFile, stubContent, 'utf8');
  }
}

for (const relPath of filesToCopy) {
  const srcFile = path.join(originalBase, relPath);
  const destFile = path.join(destBase, relPath);

  ensureDirectoryExistence(destFile);

  let content = '';

  if (relPath === 'src/app/services/language.service.ts') {
    // Generate a high-performance pure-JS/TS mock for LanguageService in React
    content = `
import * as _ from 'lodash-es';

export class LanguageService {
  getSkillModTip = (tips: Record<string, number>) => {
    if (!tips) return '';
    const labels: Record<string, string> = {
      casterMaxHP: 'caster Max HP',
      casterDefense: 'caster Def',
      caster_defense: 'caster Def',
      attackPercent: 'Attack',
      per_fewer_target: 'per fewer target',
      skill_tree: 'from Skill Tree',
      exclusive_equipment: 'from EE',
      casterSpeed: 'caster Spd',
      targetMaxHP: 'target Max HP',
      casterCurrentHPPercent: 'caster HP %',
      targetCurrentHPPercent: 'target HP %',
      numberOfTargets: 'number of targets',
      numberOfDeaths: 'number of deaths',
      skill3Stack: 'S3 Stack',
      skill1Stack: 'S1 Stack',
      enemyCounterStack: 'Counter Stack',
      rageSet: 'Rage Set',
      torrentSet: 'Torrent Set',
      bleed_detonated: 'Bleed Detonates',
      burn_detonated: 'Burn Detonates',
      bomb_detonated: 'Bomb Detonates',
    };

    const output = [];
    for (const [key, val] of Object.entries(tips)) {
      if (val !== 0 && val !== undefined) {
        output.push(\`\${val}% \${labels[key] || key}\`);
      }
    }
    return output.length ? \`(\${output.join(', ')})\` : '';
  };

  translate = (category: string, key: string): string => {
    return key;
  };
}
`;
  } else {
    content = fs.readFileSync(srcFile, 'utf8');

    // 1. Strip `@Injectable` decorator completely
    content = content.replace(/@Injectable\([\s\S]*?\)/g, '');

    // 2. Strip Router/ActivatedRoute imports and constructor arguments from DataService
    content = content.replace(/import\s+{[^}]+}\s+from\s+['"]@angular\/router['"];?/g, '');
    content = content.replace(/constructor\s*\([\s\S]*?\)\s*{}/g, 'constructor() {}');

    // 3. Clean up `@angular/core` imports, replacing with local angular_stubs imports where necessary
    content = content.replace(/import\s+{\s*EventEmitter,\s*Injectable\s*}\s+from\s+['"]@angular\/core['"];?/g, "import { EventEmitter } from './angular_stubs';");
    content = content.replace(/import\s+{\s*Injectable\s*}\s+from\s+['"]@angular\/core['"];?/g, '');

    // 4. Redirect `rxjs` imports to load generic stubs from `./angular_stubs`
    content = content.replace(/import\s+{[^}]+}\s+from\s+['"]rxjs['"];?/g, "import { BehaviorSubject } from './angular_stubs';");

    // 5. Convert absolute imports to relative imports
    const parts = relPath.split('/');
    const depth = parts.length - 2;
    const relativePrefix = '../'.repeat(depth);

    content = content.replace(/(from\s+['"])src\/app\//g, `$1${relativePrefix}app/`);
    content = content.replace(/(from\s+['"])src\/assets\//g, `$1${relativePrefix}assets/`);

    // 6. Strip TranslationPipe and other unused Angular elements
    content = content.replace(/import\s+{\s*TranslationPipe\s*}\s+from\s+['"][^'"]+['"];?/g, 'export const TranslationPipe = class { transform(x) { return x; } };');
    content = content.replace(/import\s+{\s*GoogleTagManagerService\s*}\s+from\s+['"][^'"]+['"];?/g, 'export const GoogleTagManagerService = class {};');
  }

  fs.writeFileSync(destFile, content, 'utf8');
}

console.log('Original community library successfully imported and framework-stripped under src/services/damageCalc/original/');
