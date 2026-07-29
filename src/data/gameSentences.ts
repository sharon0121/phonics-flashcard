export interface GameSentence {
  id: string;
  en: string;
  zh: string;
  words: string[];
}

function make(en: string, zh: string): GameSentence {
  return { id: en, en, zh, words: en.split(' ') };
}

// 50 short, common everyday conversational sentences (3-5 words each) for
// the word-hunt + sentence-building game. Kept short so each word can be
// hidden at its own grid cell without an unwieldy hunt.
export const BUILTIN_SENTENCES: GameSentence[] = [
  make('Good morning!', '早安！'),
  make('Good night!', '晚安！'),
  make('How are you?', '你好嗎？'),
  make('I am fine.', '我很好。'),
  make('Thank you very much.', '非常謝謝你。'),
  make('You are welcome.', '不客氣。'),
  make('What is your name?', '你叫什麼名字？'),
  make('My name is Tom.', '我的名字是湯姆。'),
  make('Nice to meet you.', '很高興認識你。'),
  make('See you later.', '待會見。'),
  make('I am hungry.', '我肚子餓了。'),
  make('I am thirsty.', '我口渴了。'),
  make('Can I have water?', '我可以喝水嗎？'),
  make('I like apples.', '我喜歡蘋果。'),
  make("I don't like milk.", '我不喜歡牛奶。'),
  make('Where is the bathroom?', '廁所在哪裡？'),
  make('It is sunny today.', '今天是晴天。'),
  make('It is raining outside.', '外面正在下雨。'),
  make('I love my family.', '我愛我的家人。'),
  make('Happy birthday to you!', '祝你生日快樂！'),
  make("Let's go to the park.", '我們去公園吧。'),
  make('I am so happy.', '我好開心。'),
  make('I am a little sad.', '我有點難過。'),
  make('Please open the door.', '請打開門。'),
  make('Please close the window.', '請關上窗戶。'),
  make('Can you help me?', '你可以幫我嗎？'),
  make('I need your help.', '我需要你的幫忙。'),
  make('What time is it?', '現在幾點了？'),
  make('It is time for bed.', '該睡覺了。'),
  make('I want to play.', '我想要玩。'),
  make("Let's eat dinner now.", '我們現在吃晚餐吧。'),
  make('Breakfast is ready.', '早餐準備好了。'),
  make('I brush my teeth.', '我刷牙。'),
  make('I wash my hands.', '我洗手。'),
  make('Look at the dog!', '看那隻狗！'),
  make('The cat is cute.', '這隻貓好可愛。'),
  make('I can jump high.', '我可以跳得很高。'),
  make('I can run fast.', '我可以跑得很快。'),
  make('Do you like ice cream?', '你喜歡冰淇淋嗎？'),
  make('Yes, I like it.', '對，我喜歡。'),
  make("No, I don't want it.", '不，我不要。'),
  make('Where are you going?', '你要去哪裡？'),
  make('I am going home.', '我要回家了。'),
  make('Come here, please.', '請過來這裡。'),
  make('Wait for me, please.', '請等等我。'),
  make('I am sorry.', '對不起。'),
  make('It is okay.', '沒關係。'),
  make('I love you, Mom.', '我愛你，媽媽。'),
  make('Sweet dreams, my dear.', '祝你有個好夢，親愛的。'),
  make("Let's clean up together.", '我們一起收拾吧。'),
];
