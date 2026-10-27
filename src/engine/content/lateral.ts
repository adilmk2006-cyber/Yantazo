/**
 * Lateral-thinking scenarios. Each case stores its hidden solution plus a
 * structured fact table, so yes/no investigations always answer
 * consistently. Wrong explanations are listed with the fact that refutes them.
 */
import type { Rng } from '../rng';

export type Mechanism =
  | 'hidden-role'
  | 'not-a-person'
  | 'double-meaning'
  | 'time-and-place'
  | 'perspective'
  | 'object-use'
  | 'assumption'
  | 'rules-of-the-game'
  | 'natural-cause';

export const MECHANISM_NAMES: Record<Mechanism, string> = {
  'hidden-role': 'a hidden role or job',
  'not-a-person': '“someone” who is not a person',
  'double-meaning': 'a word with a double meaning',
  'time-and-place': 'time zones, seasons or the calendar',
  perspective: 'an unusual point of view',
  'object-use': 'an everyday object used in an unusual way',
  assumption: 'a hidden assumption about people',
  'rules-of-the-game': 'the rules of a game or contest',
  'natural-cause': 'a natural process',
};

export type Ans = 'yes' | 'no' | 'irrelevant';

/** Generic questions answered from per-case flags. */
export const GENERIC_QUESTIONS: Record<string, string> = {
  harm: 'Was anyone hurt?',
  crime: 'Was a crime committed?',
  job: 'Is someone simply doing their job?',
  animal: 'Is an animal involved?',
  weather: 'Does the weather matter?',
  time: 'Does the time, date or season matter?',
  object: 'Is an everyday object being used in an unusual way?',
  lie: 'Is anyone lying?',
  money: 'Is money important to the explanation?',
  place: 'Does the location matter?',
  game: 'Is it part of a game, sport or show?',
  person: 'Is every “person” in the story a living human?',
};

const GENERIC_DEFAULTS: Record<string, Ans> = {
  harm: 'no',
  crime: 'no',
  lie: 'no',
  animal: 'no',
  person: 'yes',
  game: 'no',
  job: 'irrelevant',
  weather: 'irrelevant',
  time: 'irrelevant',
  object: 'irrelevant',
  money: 'irrelevant',
  place: 'irrelevant',
};

export interface LateralCase {
  id: string;
  mechanism: Mechanism;
  level: 1 | 2 | 3 | 4;
  setup: string;
  question: string;
  solution: string;
  short: string;
  keyPoints: string[];
  facts: [string, Ans, string?][];
  flags: Partial<Record<keyof typeof GENERIC_QUESTIONS, Ans>>;
  wrong: [string, string][];
  hints: [string, string, string];
}

export function genericAnswer(c: LateralCase, key: string): Ans {
  return (c.flags as Record<string, Ans>)[key] ?? GENERIC_DEFAULTS[key] ?? 'irrelevant';
}

export const LATERAL_CASES: LateralCase[] = [
  {
    id: 'phone-tester', mechanism: 'hidden-role', level: 1,
    setup: 'Every working day, Priya drops brand-new phones onto a concrete floor from carefully measured heights. Whenever one cracks, her manager thanks her.',
    question: 'Why is her manager pleased?',
    solution: 'Priya is a durability tester for the company that makes the phones. Breaking them on purpose, before they go on sale, shows the engineers exactly where the design is weak.',
    short: 'She tests the phones’ toughness for the manufacturer before they go on sale.',
    keyPoints: ['it is her job', 'she is testing how tough the phones are', 'it happens before the phones are sold'],
    facts: [
      ['Is Priya paid to do this?', 'yes'],
      ['Do the phones belong to Priya?', 'no', 'They belong to her employer.'],
      ['Is Priya angry or upset?', 'no'],
      ['Will these particular phones be sold afterwards?', 'no'],
      ['Is this happening before the phones go on sale?', 'yes'],
      ['Does the type of floor matter?', 'irrelevant'],
    ],
    flags: { job: 'yes', object: 'yes', money: 'irrelevant' },
    wrong: [
      ['She is secretly sabotaging the company.', 'Her manager thanks her — she is doing exactly what she is paid for.'],
      ['The phones are faulty and being scrapped.', 'They are brand new, and the breakages are measured to learn something.'],
      ['She is clumsy and her manager is being sarcastic.', 'She drops them deliberately from measured heights.'],
    ],
    hints: ['Her employer approves of what she does.', 'What would a company want to know before selling a product?', 'Some people are paid to break things.'],
  },
  {
    id: 'queue-sitter', mechanism: 'hidden-role', level: 2,
    setup: 'Every Saturday, Tomas joins long queues outside concert halls and new shops. He waits for hours, then walks away just as he reaches the front, without buying anything. He goes home delighted.',
    question: 'What is going on?',
    solution: 'Tomas is a professional queue-sitter. Busy clients pay him to hold their place; when he reaches the front, the client swaps in and makes the purchase.',
    short: 'He is paid to hold a place in the queue for a client, who swaps in at the front.',
    keyPoints: ['someone pays him', 'he holds a place for someone else', 'the other person buys when they reach the front'],
    facts: [
      ['Does someone else take his place?', 'yes'],
      ['Is Tomas paid for this?', 'yes'],
      ['Is he trying to buy something for himself?', 'no'],
      ['Does he know the person who takes his place?', 'yes', 'They are his clients.'],
      ['Is he trying to stop other people buying?', 'no'],
      ['Does it matter which shop or concert it is?', 'irrelevant'],
    ],
    flags: { job: 'yes', money: 'yes', person: 'yes' },
    wrong: [
      ['He changes his mind at the last moment.', 'It happens every week and he is delighted — it is planned.'],
      ['He is a mystery shopper.', 'A mystery shopper would actually buy something.'],
      ['He is protesting against long queues.', 'He leaves quietly and happily without making a fuss.'],
    ],
    hints: ['He is not the only person involved.', 'Long queues are good news for him.', 'Some busy people would rather pay than wait.'],
  },
  {
    id: 'wine-judge', mechanism: 'hidden-role', level: 1,
    setup: 'At an elegant event, a woman tastes glass after glass of expensive wine and spits every single mouthful into a bucket. Nobody thinks she is rude; in fact, everyone listens carefully to what she says.',
    question: 'Why?',
    solution: 'She is a professional wine judge. Tasting dozens of wines without swallowing keeps her sober and her judgement sharp, so spitting is normal — and her opinion is what everyone is waiting for.',
    short: 'She is a professional wine judge; spitting lets her taste many wines without getting drunk.',
    keyPoints: ['she is judging or assessing the wines', 'spitting keeps her sober', 'it is normal in her profession'],
    facts: [
      ['Is she judging the wines?', 'yes'],
      ['Does she dislike the wines?', 'no', 'She spits out the ones she likes too.'],
      ['Is she trying to stay sober?', 'yes'],
      ['Is spitting normal in her line of work?', 'yes'],
      ['Is she unwell?', 'no'],
      ['Is the bucket special?', 'irrelevant'],
    ],
    flags: { job: 'yes' },
    wrong: [
      ['The wine tastes terrible.', 'She spits out the wines she likes as well.'],
      ['She is not allowed to drink alcohol.', 'Then she would not be tasting wine at all, and nobody would be waiting for her verdict.'],
      ['It is a prank on the hosts.', 'Everyone treats it as normal and listens to her judgement.'],
    ],
    hints: ['Her opinion matters to everyone present.', 'She has to taste a great many wines in one evening.', 'What would happen if she swallowed every mouthful?'],
  },
  {
    id: 'bank-tester', mechanism: 'hidden-role', level: 3,
    setup: 'In the middle of the night, Juno slips past the bank’s guards, picks the lock of the door to the vault room and photographs the vault. She takes nothing. The next morning the bank pays her a large fee.',
    question: 'Why does the bank pay her?',
    solution: 'The bank’s managers hired Juno to test their security. Her photographs prove she got in, and her report shows exactly which weaknesses to fix. The guards were not told in advance so the test would be realistic.',
    short: 'The bank hired her to test its security; her photos prove the weaknesses she found.',
    keyPoints: ['she was hired by the bank', 'to test the security', 'the photo is proof she got in'],
    facts: [
      ['Did the bank’s managers know someone would try to get in?', 'yes', 'They hired her.'],
      ['Were the guards told in advance?', 'no'],
      ['Did Juno take anything?', 'no'],
      ['Is the photograph important?', 'yes', 'It proves she reached the vault.'],
      ['Was Juno arrested?', 'no'],
      ['Does it matter what time of night it was?', 'irrelevant'],
    ],
    flags: { job: 'yes', crime: 'no', money: 'yes' },
    wrong: [
      ['She was a thief who got caught and paid a reward to return the photos.', 'She was paid a fee, took nothing, and was never arrested.'],
      ['She blackmailed the bank with the photos.', 'Blackmail is a crime; the bank paid her an agreed fee.'],
      ['She works as a night cleaner.', 'Cleaners do not sneak past guards or pick locks.'],
    ],
    hints: ['No crime was committed.', 'Someone at the bank wanted this to happen.', 'How else would a bank find out whether its defences work?'],
  },
  {
    id: 'crash-test', mechanism: 'hidden-role', level: 1,
    setup: 'Every week, Amal’s team sends brand-new cars racing into a concrete wall. The “passengers” never complain, and the carmaker is delighted with the wrecks.',
    question: 'Why?',
    solution: 'Amal runs crash tests for the carmaker. The passengers are crash-test dummies covered in sensors; the wrecks show how well the cars protect real people.',
    short: 'They are safety crash tests with dummies, to make the cars safer.',
    keyPoints: ['it is a safety test', 'the passengers are dummies', 'it helps make cars safer'],
    facts: [
      ['Are the passengers people?', 'no', 'They are crash-test dummies.'],
      ['Is anyone hurt?', 'no'],
      ['Is the goal to make cars safer?', 'yes'],
      ['Are the cars faulty?', 'no'],
      ['Is anything measured during the crash?', 'yes'],
      ['Does the colour of the cars matter?', 'irrelevant'],
    ],
    flags: { job: 'yes', person: 'no' },
    wrong: [
      ['It is an insurance fraud.', 'The cars are wrecked openly, for the manufacturer, and measured afterwards.'],
      ['They are filming a stunt for a movie.', 'Nothing is filmed for entertainment; sensors record data.'],
      ['The passengers are prisoners being punished.', 'There are no human passengers at all.'],
    ],
    hints: ['Nobody is in danger.', 'The passengers are covered in sensors.', 'Carmakers must prove their cars protect people.'],
  },
  {
    id: 'snowman', mechanism: 'not-a-person', level: 1,
    setup: 'When the children ran outside on the first warm morning of spring, Captain Frost was gone. On the lawn lay a hat, a scarf, a carrot and two lumps of coal in a puddle. Nobody called the police.',
    question: 'What happened to Captain Frost?',
    solution: 'Captain Frost was the snowman the children had built. The warm weather melted him, leaving only his hat, scarf, carrot nose and coal eyes in a puddle.',
    short: 'Captain Frost was a snowman, and he melted in the warm weather.',
    keyPoints: ['Captain Frost was a snowman', 'the warm weather melted him'],
    facts: [
      ['Was Captain Frost a person?', 'no'],
      ['Did the children make Captain Frost?', 'yes'],
      ['Is the puddle important?', 'yes'],
      ['Did someone take Captain Frost away?', 'no'],
      ['Was anyone to blame?', 'no'],
      ['Does the type of hat matter?', 'irrelevant'],
    ],
    flags: { weather: 'yes', time: 'yes', person: 'no' },
    wrong: [
      ['He was kidnapped and the clues were left behind.', 'Nobody took him; the clues are simply what was left after he melted.'],
      ['He ran off in a hurry and dropped his things.', 'Captain Frost could not move at all.'],
      ['The neighbours played a prank.', 'Nobody did anything — the sunshine did.'],
    ],
    hints: ['Captain Frost was not a living person.', 'The weather had just changed.', 'Think about the carrot and the coal.'],
  },
  {
    id: 'robot-hoover', mechanism: 'not-a-person', level: 2,
    setup: 'Every night at 2 a.m., something in Mei’s flat bumps into the furniture, hums around the rooms and then returns to the same corner. Mei sleeps peacefully through it.',
    question: 'What is it?',
    solution: 'It is Mei’s robot vacuum cleaner. She scheduled it to clean at night; it bumps gently into furniture as it navigates and then returns to its charging dock in the corner.',
    short: 'A robot vacuum cleaner scheduled to clean at night, which returns to its charging dock.',
    keyPoints: ['it is a robot vacuum cleaner', 'it was scheduled by Mei', 'it returns to charge'],
    facts: [
      ['Is it alive?', 'no'],
      ['Did Mei arrange for this to happen?', 'yes'],
      ['Does it use electricity?', 'yes'],
      ['Is it a burglar?', 'no'],
      ['Is it a pet?', 'no'],
      ['Does it matter that it is 2 a.m.?', 'irrelevant', 'Any time would work; Mei just prefers the night.'],
    ],
    flags: { person: 'no', object: 'no', animal: 'no' },
    wrong: [
      ['A ghost haunts the flat.', 'It plugs itself into the wall to recharge.'],
      ['Her cat prowls at night.', 'Cats do not hum or return to a charging dock.'],
      ['A burglar searches the rooms.', 'Nothing is ever taken, and it runs on a schedule Mei set.'],
    ],
    hints: ['It is not alive.', 'Mei is the one who set it going.', 'It needs recharging.'],
  },
  {
    id: 'statue', mechanism: 'not-a-person', level: 2,
    setup: 'A man has stood in the town square, perfectly still, through rain, snow and heatwaves for forty years. He has never eaten or drunk anything. Every spring, people lay flowers at his feet.',
    question: 'How is this possible?',
    solution: 'The “man” is a bronze statue of a local hero. Each spring, on the anniversary of what he did, people leave flowers in his memory.',
    short: 'He is a statue; the flowers mark an anniversary.',
    keyPoints: ['he is a statue', 'the flowers honour the person he represents'],
    facts: [
      ['Is he alive?', 'no'],
      ['Is he made of metal or stone?', 'yes'],
      ['Does he represent a real person?', 'yes', 'A local hero.'],
      ['Do the flowers mark an anniversary?', 'yes'],
      ['Is he a street performer?', 'no'],
      ['Does the weather affect him?', 'irrelevant'],
    ],
    flags: { person: 'no', time: 'yes' },
    wrong: [
      ['He is a living-statue street performer.', 'No performer could stand still for forty years without eating.'],
      ['He is a protester on hunger strike.', 'Nobody survives forty years without food.'],
      ['He is a ghost.', 'He is solid and people touch him.'],
    ],
    hints: ['He is not alive.', 'He represents someone admired by the town.', 'What is often put up in a town square?'],
  },
  {
    id: 'human-cannonball', mechanism: 'double-meaning', level: 2,
    setup: 'On Monday, Teo was fired three times by his employer. Each time a crowd cheered, and at the end of the day he went home with a bonus.',
    question: 'Why was he celebrating?',
    solution: 'Teo is a circus “human cannonball”. Being fired means being shot out of a cannon into a net — the crowd cheered each launch, and three shows earned him a bonus.',
    short: 'He is a human cannonball — “fired” from a cannon in a circus act.',
    keyPoints: ['“fired” means shot from a cannon', 'he is a circus performer'],
    facts: [
      ['Did Teo lose his job?', 'no'],
      ['Is Teo a performer?', 'yes'],
      ['Is there a cannon involved?', 'yes'],
      ['Was he in danger?', 'irrelevant', 'There is a net — it is a stunt.'],
      ['Was he in an office?', 'no'],
    ],
    flags: { job: 'yes', game: 'yes', harm: 'no' },
    wrong: [
      ['He kept losing his job and being rehired.', 'He never lost his job — the crowd was cheering.'],
      ['He works in a pottery, where pots are fired.', 'Pots are fired, not people, and crowds do not cheer kilns.'],
      ['His boss was joking.', 'He really was fired — from a cannon, three times.'],
    ],
    hints: ['“Fired” does not mean what you first think.', 'A crowd was watching.', 'Think of the circus.'],
  },
  {
    id: 'photographer', mechanism: 'double-meaning', level: 3,
    setup: 'Lena shot her husband, held him under water for a few minutes, and then hung him up. That evening they went out to dinner together.',
    question: 'How?',
    solution: 'Lena is a photographer using film. She shot (photographed) her husband, developed the photo in a bath of liquid, and hung the print up to dry.',
    short: 'She took a photo of him, developed it in liquid and hung the print to dry.',
    keyPoints: ['“shot” means photographed', 'the photo was developed in liquid', 'the print was hung up to dry'],
    facts: [
      ['Was her husband hurt?', 'no'],
      ['Is “shot” meant literally?', 'no'],
      ['Was a camera involved?', 'yes'],
      ['Is this a digital camera?', 'no', 'It is old-fashioned film photography.'],
      ['Was the husband physically under water?', 'no'],
    ],
    flags: { job: 'irrelevant', object: 'yes', harm: 'no' },
    wrong: [
      ['It was a magic trick.', 'No trick is needed: every verb has a second meaning.'],
      ['Her husband is a dummy.', 'He went to dinner with her.'],
      ['It was all a dream.', 'It all really happened.'],
    ],
    hints: ['Nobody was hurt.', 'Every verb has a second meaning.', 'Think of an old-fashioned darkroom.'],
  },
  {
    id: 'drew-a-bath', mechanism: 'double-meaning', level: 1,
    setup: 'Mila drew a bath for her little brother, but neither of them got wet and no water was used.',
    question: 'How?',
    solution: 'Mila drew a picture of a bath — with a pencil — for her brother.',
    short: 'She drew a picture of a bath.',
    keyPoints: ['“drew” means made a drawing'],
    facts: [
      ['Was water involved?', 'no'],
      ['Did Mila use a pencil or crayons?', 'yes'],
      ['Is the bath real?', 'no'],
      ['Was the bathroom broken?', 'no'],
    ],
    flags: { object: 'no' },
    wrong: [
      ['The bath leaked.', 'There was never any water.'],
      ['She forgot to turn on the tap.', 'She never meant to fill a bath.'],
      ['It was too cold to bathe.', 'Nobody planned to bathe.'],
    ],
    hints: ['No water was ever planned.', '“Drew” has more than one meaning.', 'Her brother might pin it on the fridge.'],
  },
  {
    id: 'summer-christmas', mechanism: 'time-and-place', level: 2,
    setup: 'Every year, Oliver celebrates his December birthday with a barbecue on the beach, sweating in the heat. He has never left his home country.',
    question: 'How can December be so hot?',
    solution: 'Oliver lives in the Southern Hemisphere — for example in Australia — where December is the middle of summer.',
    short: 'He lives in the Southern Hemisphere, where December is summer.',
    keyPoints: ['he lives in the Southern Hemisphere', 'December is summer there'],
    facts: [
      ['Does he live in Europe?', 'no'],
      ['Is it summer in December where he lives?', 'yes'],
      ['Is it an unusual heatwave?', 'no', 'It is hot every December.'],
      ['Is the beach indoors?', 'no'],
      ['Has he moved his birthday?', 'no'],
    ],
    flags: { place: 'yes', time: 'yes', weather: 'yes' },
    wrong: [
      ['He goes to a heated indoor beach.', 'The beach is outdoors and it is hot every December.'],
      ['He celebrates his birthday in summer instead.', 'He celebrates in December.'],
      ['It is a recent heatwave.', 'It happens every single year.'],
    ],
    hints: ['Where he lives matters more than when.', 'Seasons are not the same everywhere on Earth.', 'Think of the other side of the equator.'],
  },
  {
    id: 'two-new-years', mechanism: 'time-and-place', level: 3,
    setup: 'At midnight on 31 December, Nadia cheered in the New Year. A little later, after a short flight, she cheered in the New Year at midnight again — in a different country, on the same night.',
    question: 'How?',
    solution: 'She flew west into a time zone where the clocks were several hours behind. Her flight was shorter than the time difference, so she landed before midnight local time and celebrated again.',
    short: 'She flew west into a time zone hours behind, landing before midnight there.',
    keyPoints: ['she crossed into an earlier time zone', 'the flight was shorter than the time difference'],
    facts: [
      ['Did Nadia travel?', 'yes'],
      ['Did she fly west?', 'yes'],
      ['Are time zones important?', 'yes'],
      ['Was either celebration a recording?', 'no'],
      ['Did one country use a different calendar?', 'no'],
    ],
    flags: { place: 'yes', time: 'yes' },
    wrong: [
      ['She watched a recording of the first fireworks.', 'She was really there at midnight both times.'],
      ['The second country celebrates New Year on another date.', 'Both celebrated at midnight on 31 December, local time.'],
      ['Her watch was wrong.', 'Both midnights were real local midnights.'],
    ],
    hints: ['She really did travel between the two celebrations.', 'Midnight does not happen everywhere at once.', 'Which direction should she fly to gain time?'],
  },
  {
    id: 'window-cleaner', mechanism: 'perspective', level: 2,
    setup: 'A window cleaner at a forty-storey office tower slipped and fell from his ladder. He was not hurt at all.',
    question: 'How did he escape injury?',
    solution: 'He was cleaning a ground-floor window, so he fell less than a metre.',
    short: 'He was cleaning a ground-floor window and fell only a short way.',
    keyPoints: ['he was close to the ground', 'the height of the building is irrelevant'],
    facts: [
      ['Was he high up when he fell?', 'no'],
      ['Was there a safety net?', 'no'],
      ['Does the height of the building matter?', 'no'],
      ['Was he wearing a harness?', 'no', 'He did not need one.'],
      ['Did he land on something soft?', 'irrelevant'],
    ],
    flags: { job: 'yes', place: 'yes' },
    wrong: [
      ['He was wearing a safety harness.', 'No harness or rope was involved.'],
      ['He landed on a car roof.', 'He fell less than a metre.'],
      ['It was a film stunt.', 'He really was cleaning windows.'],
    ],
    hints: ['The size of the building is a distraction.', 'Which window was he cleaning?', 'Not every window of a tall building is high up.'],
  },
  {
    id: 'vr-summit', mechanism: 'perspective', level: 2,
    setup: 'Sana stood on the summit of a famous mountain, high above the clouds. A moment later she took two steps and made a cup of tea in her kitchen.',
    question: 'How?',
    solution: 'She was wearing a virtual-reality headset at home, exploring a 3D recreation of the mountain. Taking the headset off, she walked into her kitchen.',
    short: 'She was “on” the mountain in virtual reality, at home.',
    keyPoints: ['virtual reality', 'she never left home'],
    facts: [
      ['Was she wearing something on her head?', 'yes'],
      ['Did she travel anywhere?', 'no'],
      ['Is the mountain real?', 'yes', 'But she visited a digital copy of it.'],
      ['Was she dreaming?', 'no'],
      ['Does she live on a mountain?', 'no'],
    ],
    flags: { object: 'irrelevant', place: 'yes' },
    wrong: [
      ['She lives at the top of the mountain.', 'Her kitchen is in an ordinary city flat.'],
      ['It was a dream.', 'She was wide awake.'],
      ['She was looking at a painting.', 'She could look all around her as if she were standing there.'],
    ],
    hints: ['She never left her home.', 'She was wearing something special.', 'Think of modern technology for games and tours.'],
  },
  {
    id: 'bottle-fire', mechanism: 'object-use', level: 2,
    setup: 'Stranded in the hills with no matches, no lighter and a dead phone, Ines lit a campfire at midday using only her clear plastic water bottle.',
    question: 'How?',
    solution: 'A clear bottle full of water acts as a lens. Ines focused the midday sunlight through it onto dry grass until the grass began to smoulder.',
    short: 'She used the water-filled bottle as a lens to focus sunlight onto tinder.',
    keyPoints: ['the bottle full of water acts as a lens', 'it focuses sunlight', 'onto dry tinder'],
    facts: [
      ['Was the bottle full of water?', 'yes'],
      ['Does the sun matter?', 'yes'],
      ['Could she have done this at night?', 'no'],
      ['Did she rub anything together?', 'no'],
      ['Did the water itself burn?', 'no'],
    ],
    flags: { weather: 'yes', object: 'yes', time: 'yes' },
    wrong: [
      ['She rubbed the bottle against a stick.', 'No friction was involved.'],
      ['The bottle held fuel, not water.', 'It held ordinary water.'],
      ['The bottle got hot in the sun and set the grass alight.', 'Warm plastic is not hot enough; focused light is.'],
    ],
    hints: ['It only works on a sunny day.', 'The water inside matters.', 'Think of a magnifying glass.'],
  },
  {
    id: 'cd-tree', mechanism: 'object-use', level: 1,
    setup: 'Every summer, Rui hangs old music CDs from the branches of his cherry tree, although he never plays music in the garden.',
    question: 'Why?',
    solution: 'The spinning CDs flash in the sunlight and scare birds away, protecting his cherries.',
    short: 'The shiny CDs scare birds away from his cherries.',
    keyPoints: ['to scare birds', 'to protect the fruit'],
    facts: [
      ['Are birds involved?', 'yes'],
      ['Is it mainly for decoration?', 'no'],
      ['Does the shine matter?', 'yes'],
      ['Does he want to protect the fruit?', 'yes'],
      ['Does the music on the CDs matter?', 'no'],
    ],
    flags: { animal: 'yes', object: 'yes', time: 'yes' },
    wrong: [
      ['He is recycling his old CDs.', 'He takes them down after the harvest and reuses them next year.'],
      ['He is decorating for a garden party.', 'It happens all summer, every year, only on the fruit tree.'],
      ['He is marking the tree to be cut down.', 'He wants the tree’s cherries.'],
    ],
    hints: ['Someone else wants his cherries.', 'The CDs spin and flash.', 'Birds hate sudden flashes.'],
  },
  {
    id: 'surgeon', mechanism: 'assumption', level: 1,
    setup: 'A boy and his father are rushed to hospital after a cycling accident. The surgeon on duty looks at the boy and says, “I can’t operate — this is my son.” The surgeon is telling the truth.',
    question: 'How?',
    solution: 'The surgeon is the boy’s mother. (Any other parent works too — the puzzle tests the assumption that a surgeon must be a man.)',
    short: 'The surgeon is the boy’s mother.',
    keyPoints: ['the surgeon is the boy’s other parent (his mother)'],
    facts: [
      ['Is the surgeon the father in the accident?', 'no'],
      ['Is the father in the hospital?', 'yes'],
      ['Is the surgeon a woman?', 'yes'],
      ['Is the surgeon lying?', 'no'],
      ['Is the boy adopted?', 'irrelevant'],
    ],
    flags: { job: 'yes', harm: 'yes' },
    wrong: [
      ['The surgeon is a ghost of the father.', 'The father is alive, in another room.'],
      ['The surgeon is mistaken.', 'The surgeon is telling the truth.'],
      ['The surgeon is the boy’s grandfather.', 'A grandfather would say “grandson”.'],
    ],
    hints: ['The surgeon is telling the truth.', 'Question who you pictured as the surgeon.', 'Every child has more than one parent.'],
  },
  {
    id: 'triplets', mechanism: 'assumption', level: 2,
    setup: 'Two girls were born to the same mother, on the same day of the same year, in the same hospital — yet they are not twins.',
    question: 'How?',
    solution: 'They are two of a set of triplets (or more).',
    short: 'They are two of a set of triplets.',
    keyPoints: ['there was at least one more sibling born that day', 'triplets'],
    facts: [
      ['Were other babies born to the same mother that day?', 'yes'],
      ['Were they adopted?', 'no'],
      ['Are they really sisters?', 'yes'],
      ['Were they born in different years?', 'no'],
      ['Is one of them lying?', 'no'],
    ],
    flags: { person: 'yes' },
    wrong: [
      ['They were born a year apart.', 'They were born in the same year, on the same day.'],
      ['They have different mothers.', 'They have the same mother.'],
      ['One was born just after midnight.', 'They were born on the same day.'],
    ],
    hints: ['Nothing in the story is false.', '“Twins” means exactly two.', 'How many babies were born?'],
  },
  {
    id: 'slow-race', mechanism: 'rules-of-the-game', level: 2,
    setup: 'Kai crossed the finish line after every other rider in the race, and yet he won — and nobody disputed the result.',
    question: 'How?',
    solution: 'It was a slow-bicycle race: the winner is the last rider to cross the line without putting a foot down or falling over.',
    short: 'It was a slow race — the last rider to finish without touching the ground wins.',
    keyPoints: ['the rules rewarded being slowest', 'a slow (bicycle) race'],
    facts: [
      ['Was it an ordinary race?', 'no'],
      ['Did the rules reward going slowly?', 'yes'],
      ['Were the others disqualified?', 'no'],
      ['Was Kai riding a bicycle?', 'yes'],
      ['Did he cheat?', 'no'],
    ],
    flags: { game: 'yes' },
    wrong: [
      ['Everyone else was disqualified.', 'Nobody was disqualified.'],
      ['He won on a technicality.', 'He won by the race’s actual rules.'],
      ['He rode a longer course.', 'Everyone rode the same course.'],
    ],
    hints: ['Nobody broke any rules.', 'Not all races reward speed.', 'Staying balanced is the real challenge.'],
  },
  {
    id: 'golf', mechanism: 'rules-of-the-game', level: 1,
    setup: 'At the championship, Eva scored fewer points than any other player — and was crowned champion.',
    question: 'How?',
    solution: 'In her sport (for example golf), the score counts strokes, so the lowest score wins.',
    short: 'In her sport the lowest score wins, as in golf.',
    keyPoints: ['the lowest score wins', 'e.g. golf'],
    facts: [
      ['Is it a sport where the lowest score wins?', 'yes'],
      ['Was she the best player?', 'yes'],
      ['Were the others disqualified?', 'no'],
      ['Does she play with clubs?', 'yes'],
    ],
    flags: { game: 'yes' },
    wrong: [
      ['The judges made a mistake.', 'The result was correct.'],
      ['The others cheated.', 'Nobody cheated.'],
      ['She won a prize for the worst score.', 'She was crowned champion.'],
    ],
    hints: ['Nobody broke the rules.', 'In some sports a high score is bad.', 'Think of a sport played on a course with a small ball.'],
  },
  {
    id: 'no-shadow', mechanism: 'natural-cause', level: 3,
    setup: 'On one particular day each year, at exactly noon, the flagpoles in a desert town cast no shadow at all — even though the sun is blazing.',
    question: 'Why?',
    solution: 'The town lies on a tropic. On the summer solstice the noon sun is directly overhead there, so upright poles cast no shadow beyond their own base.',
    short: 'On that day the noon sun is directly overhead, because the town lies on a tropic.',
    keyPoints: ['the sun is directly overhead', 'because of the town’s latitude on that date'],
    facts: [
      ['Is the sun directly overhead?', 'yes'],
      ['Does the town’s location matter?', 'yes'],
      ['Is it cloudy?', 'no'],
      ['Are the flagpoles unusual?', 'no'],
      ['Does it happen on every day of the year?', 'no'],
    ],
    flags: { time: 'yes', place: 'yes', weather: 'irrelevant' },
    wrong: [
      ['The poles are made of glass.', 'They are ordinary poles and cast shadows on other days.'],
      ['There is an eclipse.', 'The sun is blazing.'],
      ['The shadows fall into a pit.', 'The ground around them is flat.'],
    ],
    hints: ['It only happens at noon on one day.', 'Think about where the sun is in the sky.', 'Latitude matters.'],
  },
  {
    id: 'empty-frame', mechanism: 'hidden-role', level: 4,
    setup: 'A museum displays an empty space on a wall with a small label beside it. For weeks, crowds queue to stare at the bare wall.',
    question: 'Why do people come?',
    solution: 'A world-famous painting has just been stolen. The empty space where it hung became an attraction in its own right — something that really happened when the Mona Lisa was stolen in 1911.',
    short: 'A famous painting had been stolen, and people came to see where it used to hang.',
    keyPoints: ['a famous painting was stolen', 'people came to see the empty space'],
    facts: [
      ['Was something stolen?', 'yes'],
      ['Is the space meant to be empty?', 'no'],
      ['Does the label explain what happened?', 'yes'],
      ['Is it a work of invisible art?', 'no'],
      ['Has this happened in real life?', 'yes'],
    ],
    flags: { crime: 'yes', place: 'yes' },
    wrong: [
      ['It is invisible conceptual art.', 'The label explains what used to hang there.'],
      ['The painting is being cleaned.', 'Crowds came specifically because of what happened to it.'],
      ['It is a trick to sell tickets.', 'Something genuinely happened to the painting.'],
    ],
    hints: ['Something used to be there.', 'A crime is involved.', 'People are curious about famous losses.'],
  },
];

/* ---------------- parametric cases ---------------- */

export function leapDayCase(rng: Rng): LateralCase {
  const year = rng.pick([1984, 1988, 1992, 1996, 2000, 2004, 2008]);
  const parties = rng.int(5, 8);
  const later = year + parties * 4;
  const name = rng.pick(['Ada', 'Bilal', 'Clara', 'Darius', 'Esme', 'Felix']);
  return {
    id: `leap-${year}-${parties}`,
    mechanism: 'time-and-place',
    level: 2,
    setup: `${name} was born in ${year}. In ${later}, ${name} — healthy, honest and fond of parties — celebrated only the ${parties}th birthday party of their life, on their actual birthday, despite being ${later - year} years old.`,
    question: 'How?',
    solution: `${name} was born on 29 February, a date that only exists in leap years. Between ${year} and ${later} there have been ${parties} more leap years, so only ${parties} true birthdays.`,
    short: `${name} was born on 29 February, which only comes round every four years.`,
    keyPoints: ['born on 29 February', 'it only occurs in leap years'],
    facts: [
      ['Is the calendar important?', 'yes'],
      [`Was ${name} born on an unusual date?`, 'yes'],
      [`Is ${name} lying about their age?`, 'no'],
      [`Did ${name} skip parties by choice?`, 'no'],
      [`Was ${name} ill on birthdays?`, 'no'],
    ],
    flags: { time: 'yes' },
    wrong: [
      [`${name} only celebrates every few years to save money.`, `${name} loves parties and celebrates every actual birthday.`],
      [`${name} was ill on most birthdays.`, `${name} has always been healthy.`],
      [`${name} miscounted.`, `${name} is honest and the count is right.`],
    ],
    hints: ['The calendar is the key.', `Some dates do not appear every year.`, `${year} and ${later} have something in common.`],
  };
}

export function generationsCase(rng: Rng): LateralCase {
  const k = rng.int(2, 4);
  const words = ['', '', 'two', 'three', 'four'];
  const [rel1, rel2] = rng.pick([['mothers', 'daughters'], ['fathers', 'sons']]);
  const total = k + 1;
  const chain =
    rel1 === 'mothers'
      ? ['great-great-grandmother', 'great-grandmother', 'grandmother', 'mother', 'daughter']
      : ['great-great-grandfather', 'great-grandfather', 'grandfather', 'father', 'son'];
  const line = chain.slice(chain.length - total).join(', ');
  return {
    id: `gen-${rel1}-${k}`,
    mechanism: 'assumption',
    level: k === 2 ? 1 : 2,
    setup: `${words[k][0].toUpperCase() + words[k].slice(1)} ${rel1} and ${words[k]} ${rel2} went to the cinema. Each bought exactly one ticket, yet only ${total} tickets were sold to them.`,
    question: 'How?',
    solution: `There were only ${total} people, from ${total} generations of one family: ${line}. Everyone except the youngest is a ${rel1.slice(0, -1)}, and everyone except the eldest is a ${rel2.slice(0, -1)}.`,
    short: `There were only ${total} people — ${total} generations of one family.`,
    keyPoints: [`only ${total} people`, 'several generations of one family', 'some people are both a parent and a child'],
    facts: [
      ['Did anyone get in without a ticket?', 'no'],
      [`Were there more than ${total} people?`, 'no'],
      ['Are they all related?', 'yes'],
      ['Is someone both a parent and a child?', 'yes'],
      ['Were any tickets shared?', 'no'],
    ],
    flags: { person: 'yes' },
    wrong: [
      ['Some of them sneaked in.', 'Everyone bought exactly one ticket.'],
      ['Tickets were shared.', 'Each person had their own ticket.'],
      ['Some went to a different film.', `Only ${total} tickets were sold to the whole group.`],
    ],
    hints: ['Count people, not titles.', `Can one person be both a ${rel1.slice(0, -1)} and a ${rel2.slice(0, -1)}?`, 'Think of one family line.'],
  };
}
