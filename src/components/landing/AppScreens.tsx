import { useMemo } from 'react';
import { Logo } from '../Logo';
import { GlassCard } from '../ui/GlassCard';
import { TagChip } from '../ui/TagChip';
import { RecordOrb } from '../record/RecordOrb';
import {
  CardsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  LayersIcon,
  MicIcon,
  PulseIcon,
  SearchIcon,
  StopIcon,
  TypingIcon,
  UserIcon,
} from '../icons';
import { ALL_TAGS, CARD_COLOR_HEX, TAG_HEX } from '../../lib/tagColors';
import { mulberry32 } from '../../lib/rng';
import type { CardColorKey, ExperienceTag } from '../../types';
import { SCREEN_H, SCREEN_W } from './PhoneMockup';

// 랜딩 목업 안에 들어가는 **실제 ECHO 화면**들.
//
// 스크린샷 이미지가 아니라 앱이 쓰는 바로 그 컴포넌트(GlassCard, TagChip, RecordOrb, Logo,
// icons)와 바로 그 배경 그림(public/bg/*.webp), 바로 그 토큰(space-black, ink, echo-gradient)
// 으로 그린다. 그래서 앱 디자인이 바뀌면 랜딩의 목업도 자동으로 따라간다.
//
// 데이터만 가짜다 — Supabase에 붙지 않고, 어떤 상태도 갖지 않는다.
//
// 좌표계는 PhoneMockup의 논리 해상도(393×852)에 고정돼 있다. PhoneMockup이 통째로 축소해
// 주므로 여기서는 반응형을 신경 쓰지 않고 실제 앱과 같은 px 값을 그대로 쓴다.

type TabKey = 'record' | 'entries' | 'insights' | 'profile';

function ScreenShell({
  bg,
  position = 'center',
  topScrim = 0.36,
  activeTab,
  children,
}: {
  bg: string;
  position?: string;
  topScrim?: number;
  activeTab?: TabKey;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden bg-space-black text-ink"
      style={{ width: SCREEN_W, height: SCREEN_H }}
    >
      {/* 앱의 SpaceScene과 같은 그림·같은 스크림을 쓴다. */}
      <img
        src={`/bg/${bg}.webp`}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={{ objectFit: 'cover', objectPosition: position }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: '38%',
          background: `linear-gradient(to bottom, rgba(2,4,13,${topScrim}) 0%, rgba(2,4,13,${topScrim * 0.45}) 48%, rgba(2,4,13,0) 100%)`,
        }}
      />
      <StatusBar />
      <div className="relative h-full">{children}</div>
      {activeTab && <MockBottomNav active={activeTab} />}
    </div>
  );
}

/** iOS 상태 표시줄. 이게 없으면 "앱 화면"이 아니라 "웹 목업"처럼 읽힌다. */
function StatusBar() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-8 text-[13px] font-semibold text-white"
      style={{ height: 54, paddingTop: 12 }}
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5 opacity-90">
        {/* 신호 */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7.5" width="3" height="3.5" rx="1" opacity="0.9" />
          <rect x="4.5" y="5.5" width="3" height="5.5" rx="1" opacity="0.9" />
          <rect x="9" y="3" width="3" height="8" rx="1" opacity="0.9" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" opacity="0.45" />
        </svg>
        {/* 배터리 */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.5" />
          <rect x="2" y="2" width="15" height="8" rx="1.6" fill="currentColor" />
          <path d="M23 4v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

const NAV_ITEMS: { key: TabKey; label: string; Icon: (p: { className?: string }) => React.ReactElement; accent: string }[] = [
  { key: 'record', label: '기록', Icon: MicIcon, accent: '255, 138, 76' },
  { key: 'entries', label: '내 경험', Icon: CardsIcon, accent: '255, 160, 110' },
  { key: 'insights', label: '별자리', Icon: PulseIcon, accent: '167, 110, 255' },
  { key: 'profile', label: '내 정보', Icon: UserIcon, accent: '241, 74, 180' },
];

/**
 * 하단 네비게이션의 표시 전용 복제본.
 *
 * 진짜 BottomNav를 그대로 쓰지 않는 이유: Link와 useLocation에 묶여 있어서 랜딩 목업 안에서
 * 누르면 실제로 앱으로 이동해 버린다. 목업은 그림이어야 한다. 스타일은 BottomNav와 같게 둔다.
 */
function MockBottomNav({ active }: { active: TabKey }) {
  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 z-20 px-3 pb-4">
      <ul
        className="mx-auto flex items-stretch gap-1 rounded-[1.75rem] border border-hairline p-1.5 backdrop-blur-2xl"
        style={{
          height: '3.75rem',
          background: 'rgba(8, 15, 33, 0.4)',
          boxShadow: '0 8px 32px -14px rgba(0,0,0,0.85)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const on = item.key === active;
          return (
            <li key={item.key} className="flex-1">
              <div
                className={`relative flex h-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.4rem] border ${
                  on ? 'text-ink' : 'border-transparent text-ink-muted'
                }`}
                style={
                  on
                    ? {
                        borderColor: `rgba(${item.accent}, 0.4)`,
                        background: `rgba(${item.accent}, 0.08)`,
                        boxShadow: `0 0 20px -8px rgba(${item.accent}, 0.6)`,
                      }
                    : undefined
                }
              >
                {on && (
                  <span
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(70% 90% at 50% 118%, rgba(${item.accent}, 0.55) 0%, rgba(${item.accent}, 0.16) 42%, rgba(0,0,0,0) 74%)`,
                      filter: 'blur(6px)',
                    }}
                  />
                )}
                <span className="relative" style={on ? { color: `rgb(${item.accent})` } : undefined}>
                  <item.Icon className="h-5 w-5" />
                </span>
                <span className="relative text-[10px] font-medium leading-none">{item.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const HEADLINE_GRADIENT = 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)';

/* ── 1. 기록 홈 ─────────────────────────────────────────────────────────── */

export function RecordHomeScreen() {
  return (
    <ScreenShell bg="record-home" position="center bottom" topScrim={0.34} activeTab="record">
      <div className="flex h-full flex-col px-5 pb-[4.25rem] pt-[3.75rem]">
        <div className="shrink-0">
          <Logo size="lg" />
        </div>
        <h1 className="mt-3 shrink-0 text-[28px] font-bold leading-[1.25] tracking-tight text-ink">
          <span className="block text-lg font-semibold text-ink-dim">지수님</span>
          <span className="mt-1 block bg-clip-text text-transparent" style={{ backgroundImage: HEADLINE_GRADIENT }}>
            오늘의 경험을
          </span>
          남겨보세요
        </h1>
        <p className="mt-3 shrink-0 text-[13px] leading-relaxed text-ink-dim">
          오늘의 경험을 기록하면 AI가 생각과 감정을 구조화해
          <br />
          나만의 인사이트로 정리합니다.
        </p>

        <div className="mt-5 flex shrink-0 flex-col gap-2.5">
          <GlassCard tone="ghost" blur={false} accent="255, 138, 76" className="flex items-center gap-4 px-4 py-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 32% 26%, rgba(255,200,148,0.86) 0%, rgba(255,130,100,0.82) 34%, rgba(232,78,146,0.78) 66%, rgba(126,50,136,0.72) 100%)',
                boxShadow: '0 0 0 1px rgba(255,190,160,0.32), 0 0 26px -4px rgba(255,110,140,0.55)',
              }}
            >
              <MicIcon className="h-6 w-6 text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">음성으로 기록</span>
              <span className="mt-1 block text-xs text-ink-dim">말하면 자동으로 글로 옮깁니다.</span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          </GlassCard>

          <GlassCard tone="ghost" blur={false} accent="104, 167, 255" className="flex items-center gap-4 px-4 py-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 32% 26%, rgba(186,214,255,0.5) 0%, rgba(112,146,230,0.46) 38%, rgba(74,78,178,0.42) 70%, rgba(44,44,110,0.36) 100%)',
                boxShadow: '0 0 0 1px rgba(170,200,255,0.24), 0 0 26px -6px rgba(120,150,255,0.45)',
              }}
            >
              <TypingIcon className="h-6 w-6 text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">타이핑으로 기록</span>
              <span className="mt-1 block text-xs text-ink-dim">직접 입력합니다.</span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          </GlassCard>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <RecordOrb size="132px" icon={<MicIcon className="h-9 w-9 text-white" />} aria-label="음성으로 기록 시작" />
        </div>
      </div>
    </ScreenShell>
  );
}

/* ── 2. 음성 기록 중 ────────────────────────────────────────────────────── */

/** 녹음 화면의 파형. 실제 화면은 마이크 입력을 받아 그리지만 목업은 고정 패턴이다. */
function MockWaveform() {
  const bars = useMemo(() => {
    const random = mulberry32(4821);
    return Array.from({ length: 44 }, (_, i) => {
      // 가운데가 크고 양 끝이 작은 실제 발화 파형의 모양을 흉내낸다.
      const envelope = Math.sin((i / 43) * Math.PI) * 0.75 + 0.25;
      return Math.max(0.08, envelope * (0.35 + random() * 0.65));
    });
  }, []);

  return (
    <div className="flex h-24 items-center justify-center gap-[3px]">
      {bars.map((height, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${height * 100}%`,
            background: 'linear-gradient(to top, rgba(255,138,76,0.9), rgba(241,74,180,0.85))',
            boxShadow: '0 0 8px -2px rgba(241,74,180,0.7)',
          }}
        />
      ))}
    </div>
  );
}

export function VoiceRecordScreen() {
  return (
    <ScreenShell bg="recording" topScrim={0.3}>
      <div className="flex h-full flex-col px-5 pb-8 pt-[4.5rem]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-ink-dim">
            <ChevronLeftIcon className="h-5 w-5" />
          </span>
          <span className="flex items-center gap-2 rounded-full border border-[rgba(255,120,140,0.45)] px-3 py-1.5 text-xs font-semibold text-echo-coral">
            <span className="h-2 w-2 rounded-full bg-echo-coral" style={{ boxShadow: '0 0 10px rgba(255,102,122,0.9)' }} />
            녹음 중 · 01:24
          </span>
        </div>

        <MockWaveform />

        <GlassCard tone="strong" className="mt-2 flex-1 overflow-hidden p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">실시간 변환</p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink">
            팀 프로젝트 발표 자료를 하루 전에 다시 갈아엎게 됐다. 디자이너랑 기획 방향이 계속
            어긋나서, 내가 먼저 회의를 잡고 두 사람 의견을 표로 정리해서 보여줬다.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
            결국 기획 쪽 구조를 따르되 디자인 톤은 원래 안을 살리는 걸로 합의했고, 발표는
            무사히 끝났다. 솔직히 회의 잡기 전까지는 좀 답답했는데
            <span className="text-ink-muted">|</span>
          </p>
        </GlassCard>

        <div className="mt-4 flex items-center justify-center gap-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline text-ink-dim">
            <TypingIcon className="h-5 w-5" />
          </span>
          <RecordOrb
            size="78px"
            state="recording"
            icon={<StopIcon className="h-6 w-6 text-white" />}
            aria-label="녹음 중지"
          />
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline text-ink-dim">
            <MicIcon className="h-5 w-5" />
          </span>
        </div>
      </div>
    </ScreenShell>
  );
}

/* ── 3. AI 구조화 결과 ──────────────────────────────────────────────────── */

const STRUCTURED_ROWS: { label: string; value: string }[] = [
  { label: '상황', value: '발표 하루 전, 팀 기획 방향이 디자이너와 계속 어긋났다.' },
  { label: '역할', value: '팀 내 발표 담당이자 의견 조율자' },
  { label: '행동', value: '먼저 회의를 잡고 두 사람의 의견을 표로 정리해 비교해서 보여줬다.' },
  { label: '결과', value: '기획 구조 + 원래 디자인 톤으로 합의, 발표를 예정대로 마쳤다.' },
];

export function StructuredScreen() {
  return (
    <ScreenShell bg="detail" position="center top" topScrim={0.42} activeTab="entries">
      <div className="flex h-full flex-col px-5 pb-[4.25rem] pt-[4.25rem]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-dim">
            <ChevronLeftIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold text-ink">발표 전날 방향 조율</p>
            <p className="text-[11px] text-ink-muted">2026. 9. 18. · 음성 기록</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <TagChip tag="갈등" />
          <TagChip tag="주도성" />
          <TagChip tag="문제해결" />
        </div>

        <GlassCard tone="strong" className="mt-4 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">AI 구조화</p>
          <dl className="mt-3 space-y-3">
            {STRUCTURED_ROWS.map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] font-semibold text-cosmic-violet">{row.label}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        <GlassCard tone="strong" className="mt-2.5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">감정</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink">
            <span className="font-semibold text-echo-coral">답답함 → 후련함.</span> 말이 안 통한다고
            느꼈지만, 직접 자리를 만들자 풀렸다.
          </p>
        </GlassCard>
      </div>
    </ScreenShell>
  );
}

/* ── 4. 내 경험 — 프로젝트별로 모인 카드 뭉치 ───────────────────────────── */

// 레퍼런스: 내경험카드뭉치.png (실제 앱 스크린샷).
//
// 구조는 EntriesPage → CollectionSwipeView → EntryCardStack 그대로다.
//   "OO의 경험 기록" + 편집 버튼
//   검색창 / 태그 필터 한 줄
//   지금 보는 컬렉션(프로젝트) 이름 + 개수, 오른쪽에 "컬렉션 모음" 버튼
//   세로로 겹쳐 쌓인 카드 뭉치 (가운데 한 장만 또렷하고 테두리가 분홍)
//   오른쪽 세로 점 = 이 뭉치 안에서 몇 번째 카드인지
//   아래 가로 점 = 프로젝트가 여러 개이고 좌우로 넘길 수 있다는 뜻
//
// 카드가 위아래로 화면 밖까지 이어져 잘리는 것까지 레퍼런스와 같다 — 뭉치가 화면보다
// 두껍다는 걸 잘린 단면으로 보여주는 게 이 화면의 인상이다.

interface MockEntryCard {
  title: string;
  date: string;
  body: string;
  tags: ExperienceTag[];
  color: CardColorKey;
}

/** 지금 보고 있는 프로젝트(컬렉션) 하나에 담긴 카드들. */
const PROJECT_CARDS: MockEntryCard[] = [
  {
    title: '킥오프 역할 분담',
    date: '2026. 8. 23.',
    body: '역할을 정하는 데만 두 시간이 걸렸다. 결국 각자 하고 싶은 것부터 적어보자고 했다.',
    tags: ['협업'],
    color: 'slate',
  },
  {
    title: '중간 점검 회고',
    date: '2026. 9. 10.',
    body: '일정이 이미 이틀 밀린 걸 그제야 알았다. 남은 작업을 다시 쪼개 우선순위를 정하자고 제안했다.',
    tags: ['문제해결', '주도성'],
    color: 'navy',
  },
  {
    title: '발표 전날 방향 조율',
    date: '2026. 9. 20.',
    body: '기획과 디자인 방향이 어긋나 발표 하루 전에 자료를 갈아엎게 됐다. 먼저 회의를 잡고 두 안을 표로 비교해서 보여줬다.',
    tags: ['갈등', '주도성', '문제해결'],
    color: 'plum',
  },
  {
    title: '최종 발표',
    date: '2026. 9. 21.',
    body: '질의응답에서 예상 못 한 질문이 나왔는데, 모른다고 말하고 다음 주에 찾아보겠다고 했다.',
    tags: ['성취'],
    color: 'coral',
  },
  {
    title: '팀 해산 회고',
    date: '2026. 9. 24.',
    body: '끝나고 나니 아쉬운 것만 기억났다. 그래도 잘한 것을 하나씩 말해보기로 했다.',
    tags: ['실패'],
    color: 'rose',
  },
];

/** 가운데(또렷한) 카드의 위치. */
const ACTIVE_CARD = 2;

/** 좌우로 넘길 수 있는 프로젝트(카드 뭉치) 목록. 지금은 첫 번째를 보고 있다. */
const PROJECTS = [
  '캡스톤 디자인 팀 프로젝트',
  '교내 창업 동아리',
  '여름 인턴십',
  '학회 학술제 준비',
  '미분류',
];

const CARD_HEIGHT = 150;
const CARD_GAP = 112;

function cardTint(color: CardColorKey): string {
  const hex = CARD_COLOR_HEX[color];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
}

function EntryCard({ entry, active }: { entry: MockEntryCard; active: boolean }) {
  const tint = cardTint(entry.color);
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-3xl border backdrop-blur-[3px]"
      style={{
        background: `radial-gradient(120% 110% at 8% 0%, rgba(${tint}, 0.1) 0%, rgba(${tint}, 0.04) 38%, rgba(7, 13, 30, 0.12) 78%)`,
        borderColor: active ? 'rgba(255, 170, 190, 0.6)' : 'rgba(130, 160, 220, 0.2)',
        boxShadow: active
          ? '0 0 0 1px rgba(255,180,150,0.18), 0 0 30px -8px rgba(255,120,160,0.55)'
          : 'none',
      }}
    >
      <div
        className="flex h-full flex-col gap-2 px-5 py-4 text-white"
        // 카드가 거의 투명하므로 글자 대비는 색이 아니라 그림자로 만든다(EntryCardStack과 동일).
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[17px] font-bold text-white">{entry.title}</p>
          <p className="shrink-0 pt-1 text-[11px] text-white">{entry.date}</p>
        </div>
        {/* 태그 줄은 또렷한 카드에만 — 레퍼런스에서도 가운데 카드만 태그를 달고 있다. */}
        {active && (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-hairline bg-[rgba(4,8,20,0.5)] px-2 py-0.5 text-[10px] font-medium text-white"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        <p className="line-clamp-3 text-[13px] leading-relaxed text-white">{entry.body}</p>
      </div>
    </div>
  );
}

export function EntriesCollectionScreen() {
  return (
    <ScreenShell bg="archive" topScrim={0.4} activeTab="entries">
      <div className="flex h-full flex-col px-5 pb-[4.25rem] pt-[3.75rem]">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-[25px] font-bold leading-[1.25] tracking-tight">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: HEADLINE_GRADIENT }}>
              지수의 경험 기록
            </span>
          </h1>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(255,170,190,0.42)] text-ink-dim">
            <EditIcon className="h-4 w-4" />
          </span>
        </div>

        <div
          className="mt-4 flex shrink-0 items-center gap-3 rounded-2xl border border-hairline px-4 backdrop-blur-xl"
          style={{ background: 'rgba(10, 20, 40, 0.38)' }}
        >
          <SearchIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          <span className="min-h-[3rem] flex-1 content-center text-[15px] text-ink-muted">
            키워드로 검색 (예: 갈등)
          </span>
        </div>

        {/* 태그 6개는 한 줄에 다 들어가지 않는다 — 실제 화면처럼 오른쪽이 잘린 채로 둔다.
            잘린 단면이 "옆으로 더 있다"를 말해준다. */}
        <div className="mt-3 flex shrink-0 gap-2 overflow-hidden pb-1">
          {ALL_TAGS.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>

        {/* 지금 보고 있는 프로젝트 이름과 그 안의 기록 수 */}
        <div className="mt-4 flex shrink-0 items-center gap-2 px-1 pb-1">
          <div className="h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[15px] font-bold text-ink">
              {PROJECTS[0]}
              <span className="ml-1.5 text-xs font-medium text-ink-dim">9개</span>
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(255,170,190,0.42)] text-ink-dim">
            <LayersIcon className="h-4 w-4" />
          </span>
        </div>

        <div className="flex min-h-0 flex-1 items-stretch gap-2">
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {/* 좌우 가장자리에 살짝 비치는 옆 프로젝트의 카드 뭉치 — 이 화면에 뭉치가 하나만
                있는 게 아니라는 걸 아래 점만이 아니라 눈으로도 알 수 있게 한다. */}
            {(['left', 'right'] as const).map((side) => (
              <span
                key={side}
                aria-hidden
                className="absolute top-1/2 h-[150px] w-6 -translate-y-1/2 rounded-2xl border border-[rgba(130,160,220,0.18)]"
                style={{
                  [side]: '-14px',
                  background: 'rgba(7, 13, 30, 0.35)',
                  opacity: 0.6,
                }}
              />
            ))}

            {PROJECT_CARDS.map((entry, i) => {
              const distance = i - ACTIVE_CARD;
              const isActive = distance === 0;
              return (
                <div
                  key={entry.title}
                  className="absolute inset-x-0"
                  style={{
                    top: '50%',
                    height: CARD_HEIGHT,
                    transform: `translateY(-50%) translateY(${distance * CARD_GAP}px)`,
                    // 가운데에서 멀어질수록 흐려진다. 뒤 카드가 또렷하면 어느 게 지금 카드인지
                    // 한눈에 읽히지 않는다.
                    opacity: isActive ? 1 : Math.max(0.28, 0.62 - (Math.abs(distance) - 1) * 0.22),
                    zIndex: PROJECT_CARDS.length - Math.abs(distance),
                  }}
                >
                  <EntryCard entry={entry} active={isActive} />
                </div>
              );
            })}
          </div>

          {/* 이 뭉치 안에서 몇 번째 카드인지 — 세로로 넘기는 스택이라 점도 세로로 쌓는다. */}
          <div className="flex w-2 shrink-0 flex-col items-center justify-center gap-1.5">
            <span className="h-5 w-2 shrink-0 rounded-full" style={{ background: 'var(--echo-gradient)' }} />
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 shrink-0 rounded-full bg-ink-muted" />
            ))}
            {[0, 1].map((i) => (
              <span key={i} className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(130,160,220,0.28)]" />
            ))}
          </div>
        </div>

        {/* 카드 뭉치가 몇 개인지 — 좌우로 스와이프하면 다음 프로젝트로 넘어간다. */}
        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-center gap-1.5">
          <span className="h-2 w-6 rounded-full" style={{ background: 'var(--echo-gradient)' }} />
          {PROJECTS.slice(1).map((project) => (
            <span key={project} className="h-2 w-2 rounded-full bg-[rgba(130,160,220,0.35)]" />
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}

/* ── 5. 별자리 ──────────────────────────────────────────────────────────── */

const CLUSTER_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

/** 태그별 별무리 배치. 실제 별자리 탭처럼 군집이 흩어져 있고 각 군집 안에서 별이 선으로 이어진다. */
function useClusters() {
  return useMemo(() => {
    // 군집 중심 — 화면 안에서 겹치지 않게 손으로 잡은 위치(%)다.
    const centers = [
      { x: 26, y: 24, n: 6 },
      { x: 72, y: 20, n: 5 },
      { x: 18, y: 52, n: 7 },
      { x: 62, y: 47, n: 4 },
      { x: 34, y: 76, n: 6 },
      { x: 78, y: 72, n: 5 },
    ];

    return CLUSTER_TAGS.map((tag, ci) => {
      const random = mulberry32(9001 + ci * 137);
      const center = centers[ci];
      const stars = Array.from({ length: center.n }, () => {
        const angle = random() * Math.PI * 2;
        const radius = 3 + random() * 8;
        return {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius * 0.9,
          r: 1.1 + random() * 1.9,
        };
      });
      return { tag, color: TAG_HEX[tag], center, stars };
    });
  }, []);
}

export function ConstellationScreen() {
  const clusters = useClusters();

  return (
    <ScreenShell bg="pattern" topScrim={0.42} activeTab="insights">
      <div className="absolute inset-0">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {clusters.map((cluster) => (
            <g key={cluster.tag}>
              {/* 성운 haze — 군집이 "무리"로 읽히게 하는 가장 큰 단서다. */}
              <circle
                cx={cluster.center.x}
                cy={cluster.center.y}
                r={12}
                fill={cluster.color}
                opacity={0.1}
                style={{ filter: 'blur(6px)' }}
              />
              {/* 별을 순서대로 이어 별자리 선을 만든다. */}
              <polyline
                points={cluster.stars.map((s) => `${s.x},${s.y}`).join(' ')}
                fill="none"
                stroke={cluster.color}
                strokeWidth={0.22}
                opacity={0.5}
              />
            </g>
          ))}
        </svg>

        {/* 별 자체는 SVG가 아니라 div로 — viewBox를 늘려 쓰는(preserveAspectRatio none) 탓에
            SVG 원은 타원으로 찌그러진다. */}
        {clusters.map((cluster) =>
          cluster.stars.map((star, i) => (
            <span
              key={`${cluster.tag}-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.r * 2,
                height: star.r * 2,
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 ${star.r * 5}px ${cluster.color}`,
              }}
            />
          )),
        )}

        {/* 군집 라벨 */}
        {clusters.map((cluster) => (
          <span
            key={`label-${cluster.tag}`}
            className="absolute -translate-x-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md"
            style={{
              left: `${cluster.center.x}%`,
              top: `${cluster.center.y + 11}%`,
              color: cluster.color,
              borderColor: `${cluster.color}66`,
              background: 'rgba(10, 20, 40, 0.42)',
            }}
          >
            #{cluster.tag}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 top-[4rem] px-5">
        <h2 className="text-[22px] font-bold leading-tight text-ink">
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: HEADLINE_GRADIENT }}>
            지수님의 별자리
          </span>
        </h2>
        <p className="mt-1 text-[12px] text-ink-dim">경험 33개 · 별자리 6개</p>
      </div>

      {/* 별을 누르면 올라오는 카드 */}
      <div className="absolute inset-x-3 bottom-[5.25rem]">
        <GlassCard tone="strong" active accent="167, 110, 255" className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-bold text-ink">발표 전날 방향 조율</p>
            <span className="shrink-0 text-[11px] text-ink-muted">9. 18.</span>
          </div>
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-ink-dim">
            먼저 회의를 잡고 두 사람의 의견을 표로 정리해 비교해서 보여줬다.
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <TagChip tag="갈등" />
              <TagChip tag="주도성" />
            </div>
            <span
              className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold text-white"
              style={{ background: 'var(--echo-gradient)' }}
            >
              자세히 보기
            </span>
          </div>
        </GlassCard>
      </div>
    </ScreenShell>
  );
}

/* ── 6. STARWL 경험 카드 ────────────────────────────────────────────────── */

const STARWL_ROWS: { key: string; label: string; value: string }[] = [
  { key: 'S', label: 'Situation', value: '발표 하루 전 기획·디자인 방향이 충돌했다.' },
  { key: 'T', label: 'Task', value: '발표 담당으로서 하루 안에 방향을 합의시켜야 했다.' },
  { key: 'A', label: 'Action', value: '회의를 먼저 제안하고 두 안을 표로 비교해 공통점을 찾았다.' },
  { key: 'R', label: 'Result', value: '기획 구조 + 기존 디자인 톤으로 합의, 일정대로 발표를 마쳤다.' },
  { key: 'W', label: 'Why', value: '누가 옳은지가 아니라 무엇이 남는지를 기준으로 봤기 때문.' },
  { key: 'L', label: 'Learning', value: '갈등은 말을 늘리는 것보다 판을 바꾸는 쪽이 빨리 풀린다.' },
];

export function StarWlScreen() {
  return (
    <ScreenShell bg="detail-starwl" position="center top" topScrim={0.42} activeTab="entries">
      <div className="flex h-full flex-col px-5 pb-[4.25rem] pt-[4.25rem]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-dim">
            <ChevronLeftIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold text-ink">면접용 경험 카드</p>
            <p className="text-[11px] text-ink-muted">STARWL 변환 완료</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {STARWL_ROWS.map((row) => (
            <GlassCard key={row.key} tone="strong" className="flex gap-3 p-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white"
                style={{ background: 'var(--echo-gradient)' }}
              >
                {row.key}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  {row.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink">{row.value}</span>
              </span>
            </GlassCard>
          ))}
        </div>

        <div
          className="mt-4 flex min-h-[3rem] items-center justify-center rounded-full text-[14px] font-semibold text-white"
          style={{
            background: 'var(--echo-gradient)',
            boxShadow: '0 0 0 1px rgba(255,200,180,0.25), 0 6px 26px -10px rgba(241,74,180,0.75)',
          }}
        >
          경험 카드 복사하기
        </div>
      </div>
    </ScreenShell>
  );
}
