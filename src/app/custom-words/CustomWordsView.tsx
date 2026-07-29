'use client';

import { useState } from 'react';
import { useCustomWords, addCustomWord, updateCustomWord, deleteCustomWord } from '@/lib/customWords';
import { useCurriculum, toggleWordInWeekFresh, getCurrentWeekKey } from '@/lib/curriculum';
import EnglishSubNav from '@/components/EnglishSubNav';
import BackButton from '@/components/BackButton';
import type { Word } from '@/lib/types';

interface FormData {
  word: string;
  zh: string;
  zhuyin: string;
  kk: string;
  en: string;
  sentence: string;
  emoji: string;
}

const EMPTY_FORM: FormData = { word: '', zh: '', zhuyin: '', kk: '', en: '', sentence: '', emoji: '' };

function WordForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial ?? EMPTY_FORM);

  function field(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.word.trim() || !form.zh.trim()) return;
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-300">英文單字 *</label>
          <input
            required
            value={form.word}
            onChange={field('word')}
            placeholder="e.g. apple"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-300">中文 *</label>
          <input
            required
            value={form.zh}
            onChange={field('zh')}
            placeholder="e.g. 蘋果"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-300">Emoji</label>
          <input
            value={form.emoji}
            onChange={field('emoji')}
            placeholder="🍎"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-300">注音</label>
          <input
            value={form.zhuyin}
            onChange={field('zhuyin')}
            placeholder="ㄆㄧㄥˊㄍㄨㄛˇ"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-300">KK 音標</label>
          <input
            value={form.kk}
            onChange={field('kk')}
            placeholder="/ˋæpl/"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-300">英文解釋</label>
          <input
            value={form.en}
            onChange={field('en')}
            placeholder="a round fruit, red or green"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-300">例句</label>
        <input
          value={form.sentence}
          onChange={field('sentence')}
          placeholder="I eat an apple every day."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--hero-gold)] focus:outline-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="rounded-lg bg-[var(--hero-gold)] px-4 py-2 text-sm font-bold text-zinc-900 hover:opacity-90"
        >
          儲存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/20"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function wordToForm(w: Word): FormData {
  return { word: w.word, zh: w.zh, zhuyin: w.zhuyin, kk: w.kk, en: w.en, sentence: w.sentence, emoji: w.emoji };
}

export default function CustomWordsView() {
  const customWords = useCustomWords();
  const curriculum = useCurriculum();
  const thisWeekIds = new Set(curriculum[getCurrentWeekKey()] ?? []);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function handleAdd(data: FormData) {
    addCustomWord(data);
    setShowAddForm(false);
  }

  function handleEdit(id: string, data: FormData) {
    updateCustomWord(id, data);
    setEditingId(null);
  }

  function handleDelete(id: string) {
    if (deleteConfirm === id) {
      deleteCustomWord(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <EnglishSubNav />

      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-bold text-[var(--hero-gold)]">自訂單字</h1>
      </div>
      <p className="mt-1 text-sm text-zinc-300">
        加入字卡庫以外的單字，加入後可放入當週進度一起練習。
      </p>

      <button
        type="button"
        onClick={() => { setShowAddForm(true); setEditingId(null); }}
        className="mt-4 flex items-center gap-1.5 rounded-lg bg-[var(--hero-gold)] px-4 py-2 text-sm font-bold text-zinc-900 hover:opacity-90"
      >
        ＋ 新增單字
      </button>

      {showAddForm && (
        <div className="mt-4 rounded-xl border border-[var(--hero-gold)] bg-zinc-900 p-4">
          <p className="mb-3 text-sm font-bold text-[var(--hero-gold)]">新增自訂單字</p>
          <WordForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {customWords.length === 0 && !showAddForm ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-zinc-300">尚未新增任何自訂單字。</p>
          <p className="mt-1 text-xs text-zinc-500">點選上方「＋ 新增單字」開始加入。</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {customWords.map((w) => {
            const inThisWeek = thisWeekIds.has(w.id);
            const isEditing = editingId === w.id;

            return (
              <div
                key={w.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                {isEditing ? (
                  <>
                    <p className="mb-3 text-sm font-bold text-[var(--hero-gold)]">編輯單字</p>
                    <WordForm
                      initial={wordToForm(w)}
                      onSave={(data) => handleEdit(w.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{w.emoji || '📝'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-zinc-100">{w.word}</span>
                          {w.kk && <span className="text-xs text-zinc-400">{w.kk}</span>}
                        </div>
                        <div className="text-sm text-zinc-300">{w.zh}{w.zhuyin ? `（${w.zhuyin}）` : ''}</div>
                        {w.en && <div className="mt-0.5 text-xs text-zinc-500">{w.en}</div>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleWordInWeekFresh(getCurrentWeekKey(), w.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          inThisWeek
                            ? 'border-2 border-[var(--hero-gold)] bg-white text-zinc-800'
                            : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                        }`}
                      >
                        {inThisWeek ? '✓ 本週' : '＋ 本週'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(w.id)}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-white/20"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(w.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          deleteConfirm === w.id
                            ? 'bg-red-500 text-white'
                            : 'bg-white/10 text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
                        }`}
                      >
                        {deleteConfirm === w.id ? '確認刪除' : '刪除'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
