
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
        output.push(`${val}% ${labels[key] || key}`);
      }
    }
    return output.length ? `(${output.join(', ')})` : '';
  };

  translate = (category: string, key: string): string => {
    return key;
  };
}
