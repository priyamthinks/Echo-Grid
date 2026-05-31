// levels.js — handcrafted Echo Grid levels (data only, no logic).
//
// Each level is an ASCII map plus metadata, so levels are trivial to edit.
//
// Legend (grid characters):
//   ' ' or '.'  empty floor (sound + player pass)
//   '#'         wall            (blocks sound + player)
//   '/'  '\'    mirror          (reflects sound; player rotates these)
//   'C'         crystal         (must be hit by sound; sound passes through)
//   'A'         absorber        (destroys sound)
//   '1'..'9'    portal pair     (two cells share a digit; sound teleports)
//   '>' '<' '^' 'v'  emitter + beam direction
//   'G'         exit gate       (opens when every crystal is active)
//   '@'         player start
//
// `moves` is the budget of MIRROR ROTATIONS for the level (walking is free).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.LEVELS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    {
      name: 'First Light',
      moves: 3,
      grid: [
        '#########',
        '#   C   #',
        '#       #',
        '#>  \\   #',
        '#       #',
        '#  @  G #',
        '#########',
      ],
    },
    {
      name: 'Twin Echo',
      moves: 4,
      grid: [
        '#########',
        '#>    / #',
        '#     C #',
        '#       #',
        '# C   \\ #',
        '#  @  G #',
        '#########',
      ],
    },
    {
      name: 'The Long Way',
      moves: 4,
      grid: [
        '###########',
        '#>      / #',
        '#         #',
        '#   ### C #',
        '#   ###   #',
        '#   ###   #',
        '#  C    \\ #',
        '#   @  G  #',
        '###########',
      ],
    },
    {
      name: 'Hungry Void',
      moves: 4,
      grid: [
        '###########',
        '#> /      #',
        '#         #',
        '#  C      #',
        '#         #',
        '#C \\   A  #',
        '#         #',
        '#  @   G  #',
        '###########',
      ],
    },
    {
      name: 'Through the Gate',
      moves: 3,
      grid: [
        '###########',
        '#>    /   #',
        '#     C   #',
        '#     1   #',
        '#         #',
        '#  1      #',
        '#  C      #',
        '#@     G  #',
        '###########',
      ],
    },
    {
      name: 'Folded Space',
      moves: 3,
      grid: [
        '###########',
        '#> C  1   #',
        '#         #',
        '#       C #',
        '#     1 \\ #',
        '#         #',
        '#       A #',
        '#  @   G  #',
        '###########',
      ],
    },
    {
      name: 'Cascade',
      moves: 4,
      grid: [
        '#############',
        '#>  C  C  / #',
        '#           #',
        '#         C #',
        '#           #',
        '#           #',
        '#    C    \\ #',
        '#  @     G  #',
        '#############',
      ],
    },
    {
      name: 'Double Jump',
      moves: 3,
      grid: [
        '###########',
        '#> /      #',
        '#         #',
        '#  1     1#',
        '#        C#',
        '#  2     2#',
        '#  C      #',
        '#@     G  #',
        '###########',
      ],
    },
    {
      name: 'Three Turns',
      moves: 5,
      grid: [
        '#############',
        '#>  /     A #',
        '#         C #',
        '#   C       #',
        '#           #',
        '#   /   C \\ #',
        '#           #',
        '#  @     G  #',
        '#############',
      ],
    },
    {
      name: 'The Echo Grid',
      moves: 6,
      grid: [
        '#############',
        '#>  C     / #',
        '#         C #',
        '#           #',
        '# 1      C1 #',
        '#           #',
        '# /  C   \\  #',
        '#           #',
        '#        A  #',
        '#  @     G  #',
        '#############',
      ],
    },
  ];
});
