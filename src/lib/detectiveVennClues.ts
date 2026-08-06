// Curated A1-level clue triples for the Detective Venn game.
// Each word has exactly three clues, max 6 words each:
//   A — Appearance / touch / sound
//   B — Location / who uses it
//   C — Function / phonics (first letter or simple use)
//
// Only concrete nouns are included. Words NOT in this map are
// excluded from the active word pool so quality is guaranteed.

export interface ClueTriple {
  A: string;
  B: string;
  C: string;
}

const CLUES: Record<string, ClueTriple> = {
  // ── ANIMALS ─────────────────────────────────────────────────────────────
  ant:    { A: 'It is tiny and black.',       B: 'You see it on the ground.',    C: 'It lives in a big group.' },
  bat:    { A: 'It has wings.',               B: 'You see it at night.',          C: 'It can fly in the dark.' },
  bear:   { A: 'It is big and brown.',        B: 'It lives in the forest.',       C: 'It loves to eat honey.' },
  bee:    { A: 'It is small and yellow.',     B: 'You see it in a garden.',       C: 'It makes honey.' },
  bird:   { A: 'It has wings and a beak.',    B: 'You see it in the sky.',        C: 'It can fly and sing.' },
  bug:    { A: 'It is very small.',           B: 'You see it in the garden.',     C: 'It has six legs.' },
  cat:    { A: 'It is soft and furry.',       B: 'It lives in your home.',        C: 'It says "meow".' },
  cow:    { A: 'It is black and white.',      B: 'You see it on a farm.',         C: 'It gives us milk.' },
  crab:   { A: 'It is red and hard.',         B: 'You see it at the beach.',      C: 'It walks sideways.' },
  cub:    { A: 'It is small and fluffy.',     B: 'It lives in the forest.',       C: 'It is a baby bear.' },
  deer:   { A: 'It is brown and fast.',       B: 'It lives in the forest.',       C: 'It has long thin legs.' },
  dog:    { A: 'It has four legs.',           B: 'It lives in your home.',        C: 'It can run and fetch.' },
  duck:   { A: 'It is white or brown.',       B: 'You see it near water.',        C: 'It says "quack".' },
  fish:   { A: 'It has scales and fins.',     B: 'It lives in water.',            C: 'It swims in the sea.' },
  fly:    { A: 'It is tiny and dark.',        B: 'You see it in the kitchen.',    C: 'It can fly very fast.' },
  fox:    { A: 'It is red and furry.',        B: 'It lives in the forest.',       C: 'It is a wild animal.' },
  frog:   { A: 'It is green and wet.',        B: 'You see it near a pond.',       C: 'It can jump very high.' },
  goat:   { A: 'It has horns.',               B: 'You see it on a farm.',         C: 'It eats grass and leaves.' },
  hen:    { A: 'It has feathers.',            B: 'You see it on a farm.',         C: 'It gives us eggs.' },
  horse:  { A: 'It is tall and fast.',        B: 'You see it on a farm.',         C: 'We can ride on it.' },
  moth:   { A: 'It has soft wings.',          B: 'You see it at night.',          C: 'It flies near lights.' },
  ox:     { A: 'It is big and strong.',       B: 'You see it on a farm.',         C: 'It helps farmers work.' },
  pig:    { A: 'It is pink and round.',       B: 'You see it on a farm.',         C: 'It says "oink".' },
  pup:    { A: 'It is small and fluffy.',     B: 'It lives in your home.',        C: 'It is a baby dog.' },
  rat:    { A: 'It has a long tail.',         B: 'You see it in a house.',        C: 'It is a small animal.' },
  sheep:  { A: 'It is white and fluffy.',     B: 'You see it on a farm.',         C: 'It gives us wool.' },
  snail:  { A: 'It has a round shell.',       B: 'You see it in the garden.',     C: 'It moves very slowly.' },
  wolf:   { A: 'It is big and grey.',         B: 'It lives in the forest.',       C: 'It howls at the moon.' },
  worm:   { A: 'It is long and thin.',        B: 'You find it in the ground.',    C: 'Birds love to eat it.' },

  // ── FOOD ────────────────────────────────────────────────────────────────
  apple:  { A: 'It is red or green.',         B: 'You find it in the kitchen.',   C: 'We eat it as a fruit.' },
  bread:  { A: 'It is soft and white.',       B: 'You find it in a bakery.',      C: 'We eat it for breakfast.' },
  cake:   { A: 'It is soft and sweet.',       B: 'You eat it at a party.',        C: 'Starts with the letter C.' },
  corn:   { A: 'It is yellow and long.',      B: 'You find it in a market.',      C: 'We cook and eat it.' },
  egg:    { A: 'It is round and white.',      B: 'You find it in a nest.',        C: 'We cook and eat it.' },
  ham:    { A: 'It is pink and salty.',       B: 'You find it in a kitchen.',     C: 'We eat it in a sandwich.' },
  jam:    { A: 'It is sweet and sticky.',     B: 'You find it in a kitchen.',     C: 'We put it on bread.' },
  milk:   { A: 'It is white and cold.',       B: 'You find it in a kitchen.',     C: 'We drink it every day.' },
  nut:    { A: 'It is hard and small.',       B: 'You find it on a tree.',        C: 'We eat it as a snack.' },
  pea:    { A: 'It is green and round.',      B: 'You find it in a garden.',      C: 'We eat it with dinner.' },
  yam:    { A: 'It is brown on the outside.', B: 'You find it in a market.',      C: 'We cook and eat it.' },

  // ── HOME ────────────────────────────────────────────────────────────────
  bag:    { A: 'It has handles.',             B: 'You carry it every day.',       C: 'We put things inside it.' },
  bed:    { A: 'It is soft and flat.',        B: 'You find it in a bedroom.',     C: 'We sleep on it.' },
  box:    { A: 'It is square and hard.',      B: 'You find it anywhere.',         C: 'We put things inside it.' },
  cap:    { A: 'It is small and round.',      B: 'You wear it on your head.',     C: 'It keeps the sun away.' },
  cup:    { A: 'It is small and round.',      B: 'You find it in a kitchen.',     C: 'We drink from it.' },
  fan:    { A: 'It can spin around.',         B: 'You find it in a room.',        C: 'It keeps us cool.' },
  hat:    { A: 'It is round and wide.',       B: 'You wear it on your head.',     C: 'It keeps the sun away.' },
  key:    { A: 'It is small and metal.',      B: 'You find it at home.',          C: 'We use it to open doors.' },
  mat:    { A: 'It is flat and thin.',        B: 'You find it by the door.',      C: 'We stand on it.' },
  mop:    { A: 'It has a long handle.',       B: 'You find it at home.',          C: 'We use it to clean floors.' },
  pan:    { A: 'It is flat and round.',       B: 'You find it in a kitchen.',     C: 'We cook food in it.' },
  pot:    { A: 'It is round and heavy.',      B: 'You find it in a kitchen.',     C: 'We cook food in it.' },
  soap:   { A: 'It is smooth and white.',     B: 'You find it in a bathroom.',    C: 'We use it to wash hands.' },
  tub:    { A: 'It is big and white.',        B: 'You find it in a bathroom.',    C: 'We use it to take a bath.' },

  // ── SCHOOL ──────────────────────────────────────────────────────────────
  book:   { A: 'It is flat and square.',      B: 'You find it in a classroom.',   C: 'We read it to learn.' },
  map:    { A: 'It is flat and big.',         B: 'You find it in a school.',      C: 'We use it to find places.' },
  net:    { A: 'It has many small holes.',    B: 'You find it on a sports field.', C: 'We use it to catch things.' },
  pen:    { A: 'It is long and thin.',        B: 'You find it in a classroom.',   C: 'We use it to write.' },
  pin:    { A: 'It is tiny and sharp.',       B: 'You find it in a classroom.',   C: 'We use it to fix paper.' },

  // ── VEHICLES ────────────────────────────────────────────────────────────
  boat:   { A: 'It has a flat bottom.',       B: 'You see it on the water.',      C: 'We ride in it on a lake.' },
  bus:    { A: 'It is big and long.',         B: 'You see it on the road.',       C: 'Many people ride in it.' },
  car:    { A: 'It has four wheels.',         B: 'You see it on the road.',       C: 'We drive in it.' },
  jet:    { A: 'It is long and fast.',        B: 'You see it in the sky.',        C: 'It flies people far away.' },
  ship:   { A: 'It is very big.',             B: 'You see it on the sea.',        C: 'It carries many people.' },
  van:    { A: 'It is big and wide.',         B: 'You see it on the road.',       C: 'We use it to move things.' },

  // ── NATURE ──────────────────────────────────────────────────────────────
  flower: { A: 'It is colorful and soft.',    B: 'You see it in a garden.',       C: 'Bees love to visit it.' },
  leaf:   { A: 'It is flat and green.',       B: 'You find it on a tree.',        C: 'It falls in the autumn.' },
  log:    { A: 'It is brown and round.',      B: 'You find it in the forest.',    C: 'It is a piece of tree.' },
  moon:   { A: 'It is round and bright.',     B: 'You see it at night.',          C: 'It lights up the dark sky.' },
  mud:    { A: 'It is brown and wet.',        B: 'You find it on the ground.',    C: 'It is wet soil and water.' },
  rain:   { A: 'It is cold and wet.',         B: 'You see it from the window.',   C: 'It falls from clouds.' },
  sand:   { A: 'It is soft and yellow.',      B: 'You find it at the beach.',     C: 'We play in it.' },
  seed:   { A: 'It is tiny and hard.',        B: 'You plant it in the ground.',   C: 'It grows into a plant.' },
  star:   { A: 'It is bright and tiny.',      B: 'You see it in the night sky.',  C: 'It shines in the dark.' },
  sun:    { A: 'It is big and yellow.',       B: 'You see it in the sky.',        C: 'It gives us light and heat.' },
  tree:   { A: 'It is tall and green.',       B: 'You see it in the park.',       C: 'Birds live in it.' },

  // ── BODY PARTS ──────────────────────────────────────────────────────────
  foot:   { A: 'It has five toes.',           B: 'You use it to walk.',           C: 'We put a shoe on it.' },
  hand:   { A: 'It has five fingers.',        B: 'You use it every day.',         C: 'We use it to touch things.' },
  head:   { A: 'It is round and on top.',     B: 'It is part of your body.',      C: 'We use it to think.' },
  mouth:  { A: 'It opens and closes.',        B: 'You use it every day.',         C: 'We use it to eat and talk.' },

  // ── CLOTHING ────────────────────────────────────────────────────────────
  coat:   { A: 'It is long and warm.',        B: 'You wear it outside.',          C: 'It keeps you warm.' },

  // ── PLACES & STRUCTURES ─────────────────────────────────────────────────
  door:   { A: 'It is tall and flat.',        B: 'You find it in a building.',    C: 'We open it to go in.' },
  gate:   { A: 'It is tall and strong.',      B: 'You see it outside a house.',   C: 'We open it to go in.' },
  lake:   { A: 'It is wide and blue.',        B: 'You see it in nature.',         C: 'Fish swim in it.' },
  road:   { A: 'It is long and flat.',        B: 'You see it outside.',           C: 'Cars drive on it.' },
  wall:   { A: 'It is tall and flat.',        B: 'You find it in a building.',    C: 'We build it to divide space.' },

  // ── MISC ────────────────────────────────────────────────────────────────
  horn:   { A: 'It is hard and pointed.',     B: 'You see it on some animals.',   C: 'It makes a loud sound.' },
  ring:   { A: 'It is small and round.',      B: 'You wear it on your finger.',   C: 'It can be gold or silver.' },
  wood:   { A: 'It is hard and brown.',       B: 'You find it in a forest.',      C: 'We use it to build things.' },
};

// ── Category hints for pig detective helper ──────────────────────────────────
const WORD_CATEGORY: Record<string, string> = {
  // animals
  ant:'animal',bat:'animal',bear:'animal',bee:'animal',bird:'animal',bug:'animal',cat:'animal',
  cow:'animal',crab:'animal',cub:'animal',deer:'animal',dog:'animal',duck:'animal',fish:'animal',
  fly:'animal',fox:'animal',frog:'animal',goat:'animal',hen:'animal',horse:'animal',moth:'animal',
  ox:'animal',pig:'animal',pup:'animal',rat:'animal',sheep:'animal',snail:'animal',wolf:'animal',worm:'animal',
  // food
  apple:'food',bread:'food',cake:'food',corn:'food',egg:'food',ham:'food',jam:'food',
  milk:'food',nut:'food',pea:'food',yam:'food',
  // home
  bag:'home',bed:'home',box:'home',cap:'home',cup:'home',fan:'home',hat:'home',key:'home',
  mat:'home',mop:'home',pan:'home',pot:'home',soap:'home',tub:'home',
  // school
  book:'school',map:'school',net:'school',pen:'school',pin:'school',
  // vehicle
  boat:'vehicle',bus:'vehicle',car:'vehicle',jet:'vehicle',ship:'vehicle',van:'vehicle',
  // nature
  flower:'nature',leaf:'nature',log:'nature',moon:'nature',mud:'nature',rain:'nature',
  sand:'nature',seed:'nature',star:'nature',sun:'nature',tree:'nature',
  // body
  foot:'body',hand:'body',head:'body',mouth:'body',
  // clothing
  coat:'clothing',
  // place / structure
  door:'place',gate:'place',lake:'place',road:'place',wall:'place',
  // misc
  horn:'object',ring:'object',wood:'object',
};

const CATEGORY_HINT: Record<string, string> = {
  animal:   'It is an animal.',
  food:     'It is a food.',
  home:     'It is something you use at home.',
  school:   'It is something you use at school.',
  vehicle:  'It is a vehicle.',
  nature:   'It is found in nature.',
  body:     'It is a part of your body.',
  clothing: 'It is a piece of clothing.',
  place:    'It is a place or structure.',
  object:   'It is a type of object.',
};

export function getCategoryHint(word: string): string {
  const cat = WORD_CATEGORY[word.toLowerCase()];
  return cat ? CATEGORY_HINT[cat] ?? 'It is a real thing.' : 'It is a real thing.';
}

export function hasClues(word: string): boolean {
  return word.toLowerCase() in CLUES;
}

export function getClueTriple(word: string): ClueTriple {
  const found = CLUES[word.toLowerCase()];
  if (found) return found;
  const letter = word[0]?.toUpperCase() ?? '?';
  return {
    A: 'It is a real thing.',
    B: 'You can see and touch it.',
    C: `Starts with the letter ${letter}.`,
  };
}
