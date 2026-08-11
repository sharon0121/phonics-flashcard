import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';

interface GameEntry {
  href: string;
  emoji: string;
  iconSrc?: string;
  title: string;
  titleEn?: string;
  description: string;
  ready: boolean;
}

const games: GameEntry[] = [
  {
    href: '/games/coordinate-hunt',
    emoji: '🗺️',
    title: '座標寶藏迷宮',
    titleEn: 'Coordinate Treasure Hunt',
    description: '讀座標、認方位，挖寶找單字並拼出完整句子',
    ready: true,
  },
  {
    href: '/games/word-vault',
    emoji: '👾',
    iconSrc: '/sprites/pacman.png',
    title: '小精靈大探險',
    titleEn: 'Pac Word Adventure',
    description: '迷宮吃字母躲幽靈，再拼出正確的單字',
    ready: true,
  },
  {
    href: '/games/hero-climb',
    emoji: '🪜',
    title: '小英雄下樓梯',
    titleEn: 'Hero Ladder Descend',
    description: '左右閃避尖刺往下爬，沿路收集字母拼出英文單字！',
    ready: true,
  },
  {
    href: '/games/angry-cow',
    emoji: '🎯',
    title: '射擊吧！憤怒牛！',
    titleEn: 'Shoot! Angry Cow!',
    description: '按住蓄力射擊，放手發射，打中拿對答案牌子的牛！英文版與數學版任選',
    ready: true,
  },
  {
    href: '/games/pixel-invaders',
    emoji: '👾',
    title: '時空戰術隊',
    titleEn: 'Pixel Math Invaders',
    description: '10 秒狂轟外星人！時空凍結後答對數學題才能繼續！連答對升級三連雷射',
    ready: true,
  },
  {
    href: '/games/schulte',
    emoji: '👓',
    title: '舒爾特訓練',
    titleEn: 'Schulte Table',
    description: '注音符號、英文大小寫、數字、國字、單字，訓練專注力與視覺搜尋速度！',
    ready: true,
  },
  {
    href: '/games/klotski',
    emoji: '🔀',
    title: '動物華容道',
    titleEn: 'Animal Klotski',
    description: '滑動可愛小動物幫英雄逃出缺口，一顆星/兩顆星/三顆星三種難度，卡關還有提示跟解答',
    ready: true,
  },
  {
    href: '/games/detective-venn',
    emoji: '🔎',
    title: '豬探長與牧探長',
    titleEn: 'Venn Diagram Detective',
    description: '維恩圖線索大追捕！看線索、排英文字母，還能點單字學意思，找出神秘單字',
    ready: true,
  },
  {
    href: '/games/smart-grid',
    emoji: '🔢',
    title: '聰明格',
    titleEn: 'Smart Grid',
    description: '3×3／4×4／5×5 加法邏輯格，每列每行填 1～N 不重複，粗框內數字加起來要對！',
    ready: true,
  },
  {
    href: '/games/pizza-chef',
    emoji: '🍕',
    title: '分數披薩大廚',
    titleEn: 'Fraction Pizza Party',
    description: '動物顧客用英文點單：I want ¾ of a mushroom pizza！自己切披薩、選配料，越快送餐賺越多！',
    ready: true,
  },
  {
    href: '/games/puzzle',
    emoji: '🧩',
    title: '漫威英雄拼圖',
    titleEn: 'Marvel Heroes Jigsaw',
    description: '把英雄家族照片拼回來！4×4 到 8×8 五種難度，真實方肩圓頭卡扣形狀',
    ready: true,
  },
  {
    href: '/games/monster-dessert',
    emoji: '🍰',
    title: '怪獸點心店',
    titleEn: 'Monster Dessert Shop',
    description: '怪獸點餐：「我要 3 盤，每盤 4 個！」蓋印章、揮魔法棒複製盤子，學會 3+3+3+3 就是 3×4！',
    ready: true,
  },
  { href: '', emoji: '🧩', title: '七巧板單字拼圖', description: '平面幾何、圖形旋轉、英文拼字', ready: false },
  { href: '', emoji: '🎯', title: '軸對稱鏡像射擊', description: '線對稱幾何概念、圖形對應', ready: false },
  { href: '', emoji: '🧊', title: '3D 展開圖魔方', description: '3D 空間展開與摺疊、空間想像力', ready: false },
  { href: '', emoji: '⚖️', title: '天平秤重拼單字', description: '等式與平衡概念、基礎數學計算', ready: false },
  { href: '', emoji: '🚀', title: '邏輯數列太空賽車', description: '數字規律與邏輯、數感訓練', ready: false },
  { href: '', emoji: '🧱', title: '牆洞大比拚（磚塊補補樂）', description: '面積守恆、單位換算、輔助線分割', ready: false },
  { href: '', emoji: '🟩', title: '幾何積木拼圖大挑戰', description: '空間心智旋轉、圖形分解與組合', ready: false },
];

export default function GamesPage() {
  return (
    <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <h1 className="text-3xl font-bold text-[var(--hero-gold)]">小遊戲</h1>
        <p className="mt-2 text-sm text-zinc-300">選一個小遊戲開始玩吧！其他遊戲會陸續加入。</p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => {
            const card = (
              <>
                {g.iconSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.iconSrc}
                    alt=""
                    className="h-12 w-12"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <span className="text-5xl">{g.emoji}</span>
                )}
                <h2 className="mt-3 text-lg font-bold text-zinc-900">{g.title}</h2>
                {g.titleEn && (
                  <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{g.titleEn}</p>
                )}
                <p className="mt-2 text-xs text-zinc-500">{g.description}</p>
                {!g.ready && (
                  <span className="mt-3 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
                    敬請期待
                  </span>
                )}
              </>
            );
            const className =
              'flex flex-col items-center rounded-2xl border-[3px] border-zinc-900 bg-white p-6 text-center shadow-md transition-transform';

            return g.ready ? (
              <Link
                key={g.title}
                href={g.href}
                className={`${className} hover:-translate-y-1 hover:rotate-[0.5deg] hover:shadow-xl`}
              >
                {card}
              </Link>
            ) : (
              <div key={g.title} className={`${className} opacity-60`}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
