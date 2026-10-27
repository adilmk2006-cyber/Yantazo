/** Compact word lists used by the wordplay generators. */

/** Common short words used to build "my first is in … but not in …" clues. */
export const CLUE_WORDS = `
act add age ago aid aim air all and ant any ape arc arm art ash ask ate bad bag ban bar bat bay bed bee beg bet big bin bit bow box boy bud bug bun bus but buy cab can cap car cat cow cry cub cup cut dad day den dew did dig dim dip dog dot dry due dug ear eat egg elf elk end eye fan far fat fed few fig fin fit fix fly fog for fox fun fur gap gas gel gem get gig gum gun gut guy ham hat hay hen her hid him hip his hit hog hop hot how hub hug hut ice ill ink inn jam jar jaw jet job jog joy jug kid kin kit lab lad lap law lay leg let lid lie lip log lot low mad man map mat may men met mix mob mop mud mug nap net new nod not now nut oak oar odd off oil old one orb our out owl own pad pal pan paw pay pea peg pen pet pie pig pin pit pod pop pot pub pun pup put rag ram ran rat raw ray red rib rid rig rim rip rob rod rot row rub rug run rye sad sag sap sat saw say sea set sew shy sin sip sir sit six ski sky sly sob sod son sow soy spa spy sun tab tag tan tap tar tax tea ten tie tin tip toe ton top toy try tub tug two urn use van vat vet vow wag war wax way web wed wet who why wig win wit woe wok won yak yam yes yet zap zip zoo
able acid aged also arch area army atom aunt away axis baby back bake ball band bank bark barn base bath bead beak beam bean bear beat bell belt bend best bike bird bite blue boat body bold bolt bone book boot born boss both bowl bulb bull burn bush busy cage cake calf calm camp cane card care cart case cash cave cell chef chin chip city clay clip club coal coat code coin cold comb cook cool cope copy cord core corn cost crab crew crop crow cube cure curl dame damp dark dart dash data dawn deal dear deck deep deer desk dial dice diet dime dine dirt dish dive dock does doll dome door dose dove down drag draw drip drop drum duck dust duty each earn east easy edge else epic even exam exit face fact fade fail fair fall fame farm fast fate fear feet fern film find fine fire firm fish fist five flag flat flaw flea fled flip flow foam fold folk font food foot fork form fort four fowl free frog from fuel full fund fuse gain game gate gear gift girl give glad glow glue goal goat gold golf good gown grab gram gray grew grid grim grin grip grow gulf gust hail hair half hall halt hand hang harp hate have hawk head heal heap heat heel help herb herd hero hide high hike hill hint hive hold hole home hood hook hope horn hose host hour huge hunt hurt idea iron item jade jail jazz joke jump just keen keep kept kick kind king kiss kite knee knew knit knob knot know lace lady lake lamb lamp land lane last late lawn lead leaf lean left lend lens life lift like lime line link lion list live load loaf loan lock loft lone long look loop lord lose loud love luck lung made mail main make mall many mark mask mast math maze meal meat meet melt menu mild milk mill mind mine mint miss mist mode mole mood moon more moss most moth move much mule must myth nail name navy near neat neck need nest news next nice nine node none noon nose note oath obey once only open oval oven over pace pack page pain pair palm park part past path peak pear peel pick pier pile pine pink pipe plan play plot plug plum poem poet pole pond pony pool poor pork port pose post pour pray prey pull pump pure push race rack raft rail rain rake ramp rank rare rate read real rear reef rest rice rich ride ring riot rise risk road roam roar robe rock role roll roof room root rope rose ruby rule rush rust safe sage sail salt same sand save scar seal seat seed seek seem self sell send ship shoe shop shot show shut sick side sign silk sing sink site size skin slip slow snow soap sock soft soil some song soon sort soul soup sour spin spot star stay stem step stir stop such suit sure swan swim tail take tale talk tall tame tank tape task team tear tell tent term test text than that them then they thin tide tidy tile time tiny tire toad told toll tone tool tour town trap tray tree trim trip true tube tune turn twin type unit upon used vase vast verb very vest view vine vote wade wage wait wake walk wall wand want ward warm wash wave weak wear week well west what when whip wide wife wild will wind wine wing wire wise wish wolf wood wool word work worm wrap yard yarn year yell zero zone
`.trim().split(/\s+/);

/** Answer words for letter riddles, with a definition for "my whole". */
export const LETTER_ANSWERS: [string, string][] = [
  ['safe', 'a strong box for valuables'],
  ['clue', 'a hint that helps solve a mystery'],
  ['vault', 'a guarded room for treasure'],
  ['lock', 'it keeps a door shut'],
  ['maze', 'a puzzle of winding paths'],
  ['riddle', 'a question that hides its answer'],
  ['cipher', 'a secret way of writing'],
  ['code', 'a system of secret signals'],
  ['lamp', 'it lights up a dark room'],
  ['candle', 'a light made of wax'],
  ['mirror', 'it shows you yourself'],
  ['globe', 'a round map of the world'],
  ['planet', 'a world that orbits a star'],
  ['river', 'water flowing towards the sea'],
  ['island', 'land with water all around'],
  ['bridge', 'it carries a road over water'],
  ['castle', 'a fortress for a king'],
  ['tower', 'a tall, narrow building'],
  ['garden', 'a place where flowers grow'],
  ['forest', 'a great many trees'],
  ['winter', 'the coldest season'],
  ['clock', 'it tells the time'],
  ['piano', 'an instrument with black and white keys'],
  ['tiger', 'a striped big cat'],
  ['horse', 'an animal you can ride'],
  ['lemon', 'a sour yellow fruit'],
  ['bread', 'a baked loaf'],
  ['chair', 'something you sit on'],
  ['table', 'something you eat at'],
  ['window', 'something you look through'],
  ['stone', 'a small piece of rock'],
  ['cloud', 'it floats in the sky and may bring rain'],
  ['storm', 'wind, rain and thunder'],
  ['ocean', 'the largest kind of sea'],
  ['train', 'it runs on rails'],
  ['honey', 'a sweet food made by bees'],
  ['pearl', 'a gem found in an oyster'],
  ['silver', 'a shiny grey precious metal'],
  ['sword', 'a long bladed weapon'],
  ['shield', "a knight's protective board"],
  ['crown', "a ruler's headpiece"],
  ['puzzle', 'something to be solved'],
  ['secret', 'something kept hidden'],
  ['letter', 'a written message'],
  ['pencil', 'a writing stick'],
  ['bottle', 'a container with a neck'],
  ['market', 'a place to buy and sell'],
  ['rocket', 'it carries astronauts into space'],
  ['comet', 'an icy wanderer with a glowing tail'],
  ['orbit', 'a path around a planet'],
  ['torch', 'a portable light'],
  ['spider', 'an eight-legged web spinner'],
  ['anchor', 'it holds a ship in place'],
  ['ladder', 'you climb it rung by rung'],
  ['basket', 'a woven container'],
];

export const ANAGRAM_CATEGORIES: Record<string, { label: string; words: string[] }> = {
  animal: {
    label: 'an animal',
    words: 'lion tiger horse zebra camel otter panda koala eagle whale shark mouse sheep goat wolf bear deer moose rabbit badger ferret beaver donkey monkey parrot falcon pigeon turtle lizard spider salmon walrus jaguar cougar gecko heron raven llama bison hyena okapi dingo puffin toucan gorilla giraffe dolphin hamster penguin octopus ostrich leopard cheetah buffalo panther lobster pelican peacock flamingo kangaroo elephant squirrel hedgehog tortoise antelope crocodile chameleon porcupine armadillo'.split(' '),
  },
  food: {
    label: 'a fruit or vegetable',
    words: 'apple lemon melon mango grape peach pear plum lime kiwi cherry banana orange papaya guava olive onion carrot potato tomato radish turnip pepper celery garlic ginger apricot avocado coconut lettuce cabbage spinach pumpkin parsnip broccoli zucchini cucumber beetroot pineapple raspberry blueberry strawberry watermelon cauliflower asparagus'.split(' '),
  },
  instrument: {
    label: 'a musical instrument',
    words: 'piano flute cello viola drums harp organ tuba oboe banjo bugle sitar guitar violin trumpet clarinet trombone saxophone accordion harmonica xylophone bagpipes ukulele mandolin bassoon cymbals tambourine'.split(' '),
  },
  country: {
    label: 'a country',
    words: 'spain italy chile china india japan kenya egypt france brazil canada mexico norway sweden poland greece ireland germany morocco nigeria vietnam iceland finland denmark portugal thailand malaysia argentina australia indonesia'.split(' '),
  },
  job: {
    label: 'a job',
    words: 'baker nurse pilot judge chef tailor farmer doctor dentist lawyer artist author singer dancer plumber teacher painter surgeon soldier gardener engineer detective librarian architect astronaut carpenter'.split(' '),
  },
};
