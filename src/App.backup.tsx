import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Top, Button, Spacing, AlertDialog, BottomSheet, ConfirmDialog, Stepper, Tooltip } from "@toss/tds-mobile";
import { colors } from "@toss/tds-colors";
import { CalendarIcon, PartyPopperIcon, PuddingPuddingIcon, MainPuddingImage, EmptyDishIcon, PlusIcon } from "./FigmaIcons";
import "./App.css";

/* ─────────────────── Types ─────────────────── */
interface Todo {
  id: string;
  date: string;
  task: string;
  reward: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  puddingType: string;
}

/* ─────────────────── Storage ─────────────────── */
const KEY = "pudding_todos";

function getToday() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
function loadAll(): Todo[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveAll(todos: Todo[]) { localStorage.setItem(KEY, JSON.stringify(todos)); }
function getTodayTodos(): Todo[] { return loadAll().filter((t) => t.date === getToday()); }
function getCompletedTodos(): Todo[] { return loadAll().filter((t) => t.completed); }
function getAllDates(): string[] { return [...new Set(loadAll().map((t) => t.date))].sort((a, b) => b.localeCompare(a)); }
function getTodosByDate(date: string): Todo[] { return loadAll().filter((t) => t.date === date); }
function addTodo(task: string, reward: string, puddingType: string = "classic"): Todo {
  const all = loadAll();
  const t: Todo = { id: crypto.randomUUID(), date: getToday(), task, reward, completed: false, createdAt: new Date().toISOString(), puddingType };
  saveAll([...all, t]);
  return t;
}
function completeTodo(id: string) { saveAll(loadAll().map((t) => t.id === id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t)); }
function uncompleteTodo(id: string) { saveAll(loadAll().map((t) => { if (t.id !== id) return t; const { completedAt: _, ...r } = t; return { ...r, completed: false }; })); }
function deleteTodo(id: string) { saveAll(loadAll().filter((t) => t.id !== id)); }

/* ─────────────────── Constants ─────────────────── */
const REWARD_CATEGORIES = [
  { label: '카페/음료', icon: '/figma-assets/icon/ic-icecream.svg', kw: ['좋아하는 카페 가기', '달달한 라떼 사먹기', '버블티 사먹기', '아이스 아메리카노 사먹기'] },
  { label: '쇼핑', icon: '/figma-assets/icon/ic-shopping.svg', kw: ['갖고 싶었던거 하나 사기', '좋아하는 굿즈 사기', '좋아하는 브랜드 구경하기'] },
  { label: '취미', icon: '/figma-assets/icon/Img.svg', kw: ['영화 한 편 보기', '드라마 정주행', '좋아하는 음악 듣기', '책 한 권 읽기'] },
  { label: '휴식', icon: '/figma-assets/icon/ic-sofa.svg', kw: ['낮잠 1시간', '따뜻하게 목욕하기', '아무것도 안 하기', '일찍 자기', '소파에 드러눕기'] },
  { label: '스트레스 해소', icon: '/figma-assets/icon/ic-fire.svg', kw: ['마라탕 먹기', '매운 떡볶이 먹기', '코인 노래방 가기', '불닭볶음면 먹기'] },
];

export const PUDDING_DESIGNS = [
  { id: 'classic', name: '커스터드 푸딩', label: '탱글탱글한', image: '/figma-assets/icon/img-pudding-main.png', bg: '#F8C600' },
  { id: 'choco', name: '초코 푸딩', label: '달콤쌉쌀한', image: '/figma-assets/icon/img-pudding-coco.png', bg: '#8B4513' },
  { id: 'green', name: '말차 푸딩', label: '쌉쌀한', image: '/figma-assets/icon/img-pudding-green.png', bg: '#4CAF50' },
  { id: 'purple', name: '포도 푸딩', label: '상큼한', image: '/figma-assets/icon/img-pudding-purple.png', bg: '#9C27B0' },
];

/* ─────────────────── Pudding SVG ─────────────────── */
function PuddingSVG({ done, type = "classic", size = 80, animated = false }: { done: boolean; type?: string; size?: number; animated?: boolean }) {
  const design = PUDDING_DESIGNS.find(d => d.id === type) || PUDDING_DESIGNS[0];
  
  return (
    <svg width={size} height={Math.round(size * 112 / 120)} viewBox="0 0 120 112" fill="none"
      className={animated ? "anim-pop" : ""}>
      {/* Base Pudding Body */}
      <path d="M 60,10 C 72,10 90,32 96,55 Q 110,55 110,67 V 88 Q 110,102 94,102 H 26 Q 10,102 10,88 V 67 Q 10,55 24,55 C 30,32 48,10 60,10 Z"
        fill={design.bg} stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx="12" cy="99" rx="10" ry="8" fill={design.bg} stroke="#1A1A1A" strokeWidth="2.8" />
      <ellipse cx="108" cy="99" rx="10" ry="8" fill={design.bg} stroke="#1A1A1A" strokeWidth="2.8" />
      
      {/* Face */}
      {done ? (
        <>
          <path d="M 43,72 Q 47.5,66 52,72" stroke="#1A1A1A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M 68,72 Q 72.5,66 77,72" stroke="#1A1A1A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M 45,84 Q 60,97 75,84" stroke="#1A1A1A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <ellipse cx="38" cy="83" rx="7" ry="5" fill="#FFB59A" opacity="0.65" />
          <ellipse cx="82" cy="83" rx="7" ry="5" fill="#FFB59A" opacity="0.65" />
        </>
      ) : (
        <>
          <rect x="43" y="69" width="7" height="7" rx="1.5" fill="#1A1A1A" />
          <rect x="70" y="69" width="7" height="7" rx="1.5" fill="#1A1A1A" />
          <rect x="54" y="85" width="12" height="4" rx="2" fill="#1A1A1A" />
        </>
      )}
    </svg>
  );
}

/* ─────────────────── Confetti ─────────────────── */
function Confetti() {
  const confettiColors = [colors.yellow500, colors.yellow500, colors.red400, colors.green500];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: "-10px", left: `${5 + (i * 5.5) % 90}%`, width: i % 3 === 0 ? 9 : 6, height: i % 3 === 0 ? 9 : 6, borderRadius: i % 2 === 0 ? "50%" : 2, background: confettiColors[i % confettiColors.length], animation: `confetti ${1.2 + (i % 4) * 0.15}s ${(i * 0.07).toFixed(2)}s ease-out forwards` }} />
      ))}
    </div>
  );
}

/* ─────────────────── Custom Bottom Sheet ─────────────────── */
function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "center" }}>
      {/* Full-screen dimmer */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", animation: "fadeIn 0.2s ease" }}
      />
      {/* Sheet — full width to match WebView */}
      <div style={{ position: "relative", width: "100%", alignSelf: "flex-end" }}>
        <div
          ref={sheetRef}
          style={{
            background: colors.white,
            borderRadius: "20px 20px 0 0",
            maxHeight: "90vh",
            overflowY: "auto",
            animation: "slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.grey200 }} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}


/* ─────────────────── Onboarding Page ─────────────────── */
function OnboardingPage({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const portal = document.getElementById('tds-mobile-portal-container');
    if (portal) portal.style.display = 'none';
    return () => {
      if (portal) portal.style.display = '';
    };
  }, []);

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: colors.white }}>
      <div style={{ flex: 1, padding: "60px 24px 40px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: colors.grey900, lineHeight: 1.4, marginBottom: 8 }}>
          오늘 할 일 끝내고<br />나만의 푸딩 받기
        </div>
        <div style={{ fontSize: 15, color: colors.grey600, marginBottom: 40 }}>
          할 일을 마칠 때마다 나만의 푸딩이 채워져요
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 50 }}>
          <div className="anim-float">
            <MainPuddingImage />
          </div>
        </div>
        <div style={{ flex: 1, paddingTop: 12 }}>
          <Stepper>
            {[
              { icon: <CalendarIcon />, title: "오늘의 할 일 설정하기", desc: "오늘 꼭 시작하고 싶은 일을 써주세요" },
              { icon: <PartyPopperIcon />, title: "나에게 줄 보상 푸딩 설정하기", desc: "완료 후 나에게 줄 작은 행복을 정해요" },
              { icon: <PuddingPuddingIcon />, title: "완료 후 푸딩 꺼내기", desc: "투두를 끝내면 빈 접시에 푸딩이 나타나요" },
            ].map((step, i) => (
              <Stepper.StepperRow 
                key={i}
                left={<div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>{step.icon}</div>}
                center={<Stepper.Texts type="A" title={step.title} description={step.desc} />}
              />
            ))}
          </Stepper>
        </div>
        <button
          onClick={onNext}
          style={{ width: "100%", padding: "18px 0", borderRadius: 16, background: colors.yellow500, color: "rgba(0,12,30,0.8)", fontSize: 17, fontWeight: 700, border: "none", cursor: "pointer", transition: "opacity 0.2s" }}
        >
          오늘의 할 일 작성하기
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Add Todo Page ─────────────────── */
function AddTodoPage({ onAdd, onBack }: { onAdd: (task: string, reward: string, type: string) => void; onBack: () => void }) {
  const [task, setTask] = useState('');
  const [reward, setReward] = useState('');
  const [category, setCategory] = useState(REWARD_CATEGORIES[0]);

  const isValid = task.trim().length > 0 && reward.trim().length > 0;

  useEffect(() => {
    const portal = document.getElementById('tds-mobile-portal-container');
    if (portal) portal.style.display = 'none';
    return () => {
      if (portal) portal.style.display = '';
    };
  }, []);

  return (
    <div style={{ background: '#EFF0EB', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      <div style={{ flex: 1, paddingBottom: 130, paddingTop: 10 }}>
        {/* Title */}
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src='/figma-assets/img11.png' alt='pudding' style={{ width: 24, height: 24, objectFit: 'cover' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1c1c22', lineHeight: 1.5 }}>오늘의 할 일</span>
        </div>

        {/* Empty Dish Illustration */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 30px' }}>
          <img src="/figma-assets/emptyDish.svg" alt="empty dish" style={{ width: 192, height: 86 }} />
        </div>

        {/* Task Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ padding: '0 24px', fontSize: 13, fontWeight: 510, color: 'rgba(0,12,30,0.8)' }}>오늘의 할 일</div>
          <div style={{ padding: '0 20px' }}>
            <input
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder='예) 영단어 50개 외우기'
              style={{ width: '100%', height: 54, background: '#f9fafb', border: task ? '1.5px solid #ffc342' : '1.5px solid transparent', borderRadius: 14, padding: '0 16px', fontSize: 15, fontWeight: 510, color: '#191f28', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Reward Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          <div style={{ padding: '0 24px', fontSize: 13, fontWeight: 510, color: 'rgba(0,12,30,0.8)' }}>완료 후 나에게 줄 보상</div>
          <div style={{ padding: '0 20px' }}>
            <input
              value={reward}
              onChange={e => setReward(e.target.value)}
              placeholder='예) 아이스크림 하나 먹기'
              style={{ width: '100%', height: 54, background: '#f9fafb', border: reward ? '1.5px solid #ffc342' : '1.5px solid transparent', borderRadius: 14, padding: '0 16px', fontSize: 15, fontWeight: 510, color: '#191f28', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Category Chips */}
        <div style={{ padding: '16px 20px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {REWARD_CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => setCategory(cat)}
              style={{
                background: category.label === cat.label ? '#ffefbf' : 'rgba(253,253,254,0.89)',
                border: '1.2px solid ' + (category.label === cat.label ? 'rgba(249,172,0,0.59)' : '#d1d6db'),
                borderRadius: 999,
                padding: '0 13px',
                minHeight: 38,
                fontSize: 13,
                fontWeight: 510,
                color: '#333d4b',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <img src={cat.icon} alt={cat.label} style={{ width: 14, height: 14 }} /> {cat.label}
            </button>
          ))}
        </div>

        {/* Keyword Chips */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {category.kw.map(kw => (
            <button
              key={kw}
              onClick={() => setReward(kw)}
              style={{
                background: 'rgba(2, 32, 71, 0.05)',
                border: 'none',
                borderRadius: 999,
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 38,
                fontSize: 14,
                fontWeight: 510,
                color: 'rgba(3,24,50,0.46)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {kw}
            </button>
          ))}
        </div>

        {/* Preview Card - shown when both task and reward are filled */}
        {isValid && (
          <div style={{ padding: '8px 20px 20px' }}>
            <div style={{ background: '#f9fafb', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/figma-assets/icon/img-pudding-small.svg" alt="pudding" style={{ width: 52, height: 52, objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ fontSize: 14, lineHeight: '25.5px', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'rgba(0,12,30,0.8)' }}>{task}</span>
                  <span style={{ fontWeight: 510, color: 'rgba(3,24,50,0.46)' }}>완료하면</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: '25.5px', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'rgba(0,12,30,0.8)' }}>{reward}</span>
                  <span style={{ fontWeight: 510, color: 'rgba(3,24,50,0.46)' }}>얻을 수 있어요</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA - matches background color, no white */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ height: 36, background: 'linear-gradient(to bottom, rgba(239,240,235,0), #EFF0EB)' }} />
        <div style={{ background: '#EFF0EB', padding: '0 20px 20px' }}>
          <button
            onClick={() => isValid && onAdd(task, reward, PUDDING_DESIGNS[Math.floor(Math.random() * PUDDING_DESIGNS.length)].id)}
            disabled={!isValid}
            style={{ width: '100%', height: 56, background: isValid ? colors.yellow500 : '#f2f4f6', color: isValid ? '#333d4b' : '#b0b8c1', border: 'none', borderRadius: 16, fontSize: 17, fontWeight: 600, cursor: isValid ? 'pointer' : 'default', transition: 'background 0.2s' }}
          >
            작성 완료
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Todo Row ─────────────────── */
function TodoRow({ todo, onCheck, onDelete }: { todo: Todo; onCheck: () => void; onDelete: () => void }) {
  return (
    <div
      style={{ width: '100%' }}
      onContextMenu={(e) => { e.preventDefault(); onDelete(); }}
    >
      <div style={{
        background: '#f9fafb',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: 1,
        transition: 'opacity 0.2s',
      }}>
        {/* Pudding image */}
        <div style={{ width: 50, height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src="/figma-assets/icon/img-pudding-small.svg" alt="pudding" style={{ width: 50, height: 50, objectFit: 'contain' }} />
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: '25.5px', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'rgba(0,12,30,0.8)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.task}</span>
            <span style={{ fontWeight: 510, color: 'rgba(3,24,50,0.46)', flexShrink: 0 }}>완료하면</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'rgba(0,12,30,0.8)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.reward}</span>
            <span style={{ fontWeight: 510, color: 'rgba(3,24,50,0.46)', flexShrink: 0 }}>받을 수 있어요!</span>
          </div>
        </div>

        {/* Check button */}
        <button
          onClick={todo.completed ? undefined : onCheck}
          style={{ width: 24, height: 24, flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: todo.completed ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        >
          {todo.completed ? (
            <>
              <img src="/figma-assets/check-checked.svg" alt="checked" style={{ width: 24, height: 24, position: 'absolute' }} />
              <img src="/figma-assets/check-tick.svg" alt="tick" style={{ width: 10, height: 10, position: 'absolute' }} />
            </>
          ) : (
            <img src="/figma-assets/check-unchecked.svg" alt="unchecked" style={{ width: 24, height: 24 }} />
          )}
        </button>
      </div>
    </div>
  );
}


/* ─────────────────── Acquired Popup ─────────────────── */
function AcquiredPopup({ todo, onClose }: { todo: Todo | null; onClose: () => void }) {
  if (!todo) return null;
  const design = PUDDING_DESIGNS.find(d => d.id === todo.puddingType) || PUDDING_DESIGNS[0];
  return (
    <AlertDialog
      open={!!todo}
      onClose={onClose}
      title="새로운 푸딩을 얻었어요!"
      description={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 15, color: '#4e5968', marginBottom: 8 }}>{design.name} 획득</div>
          <img src={design.image} alt="pudding" style={{ width: 120, height: 120, objectFit: 'contain' }} />
          
          <div style={{ width: '100%', background: '#f9fafb', borderRadius: 14, padding: '14px 16px', marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
              <div style={{ fontSize: 14, lineHeight: '25.5px', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'rgba(0,12,30,0.8)' }}>{todo.task}</span>
                <span style={{ fontWeight: 510, color: 'rgba(3,24,50,0.46)' }}>완료해서</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: '25.5px', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'rgba(0,12,30,0.8)' }}>{todo.reward}</span>
                <span style={{ fontWeight: 510, color: 'rgba(3,24,50,0.46)' }}>얻었어요!</span>
              </div>
            </div>
          </div>
        </div>
      }
      alertButton={<button onClick={onClose} style={{ width: '100%', height: 56, background: colors.yellow500, color: '#191f28', border: 'none', borderRadius: 16, fontSize: 17, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', marginTop: 8 }}>달달한 보상 즐기기</button>}
    />
  );
}

/* ─────────────────── Home Page ─────────────────── */
function HomePage({ onTabChange, onAddClick }: { onTabChange: (t: string) => void; onAddClick: () => void }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [acquired, setAcquired] = useState<Todo | null>(null);
  const [confirmingTodo, setConfirmingTodo] = useState<Todo | null>(null);
  const [allTodos, setAllTodos] = useState<Todo[]>([]);

  useEffect(() => { setTodos(getTodayTodos()); setLoaded(true); }, []);
  useEffect(() => { setAllTodos(getCompletedTodos()); }, []);

  const handleCheck = useCallback((todo: Todo) => {
    if (todo.completed) {
      uncompleteTodo(todo.id);
      setTodos((p) => p.map((t) => t.id === todo.id ? { ...t, completed: false } : t));
    } else {
      setConfirmingTodo(todo);
    }
  }, []);

  const handleConfirmCheck = useCallback((todo: Todo) => {
    completeTodo(todo.id);
    const updated = { ...todo, completed: true, completedAt: new Date().toISOString() };
    setTodos((p) => p.map((t) => t.id === todo.id ? updated : t));
    setConfirmingTodo(null);
    setTimeout(() => setAcquired(updated), 400);
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteTodo(id);
    setTodos((p) => p.filter((t) => t.id !== id));
  }, []);

  const [clickCount, setClickCount] = useState(0);
  const [isBouncing, setIsBouncing] = useState(false);

  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  const allTotal = allTodos.length;
  const streak = calculateStreak(allTodos);
  const isEmpty = loaded && totalCount === 0;

  const completedMessage = useMemo(() => {
    const msgs = [
      "푸딩은 언제나 널 응원해! 🍮", 
      "앗, 간지러워! 😆", 
      "정말 멋진 하루였어!", 
      "달콤한 휴식 시간이야 🥄", 
      "내일도 함께 달릴 준비 됐지?",
      "말랑말랑 기분 좋은 하루! ✨"
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }, [completedCount, clickCount]);

  const handlePuddingClick = () => {
    if (isBouncing) return;
    setIsBouncing(true);
    setClickCount(c => c + 1);
    setTimeout(() => {
      setIsBouncing(false);
    }, 150);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', paddingTop: 10 }}>
      {/* Body content: flex col, gap 16 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 100 }}>
        {/* Badge row - float right */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '16px 20px' }}>
          <div style={{ background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 12px', borderRadius: 48 }}>
            <div style={{ transform: 'rotate(180deg) scaleY(-1)', width: 18, height: 18, overflow: 'hidden' }}>
              <img src='/figma-assets/img11.png' alt='pudding' style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 590, color: 'rgba(0,19,43,0.58)', whiteSpace: 'nowrap', lineHeight: 1.252 }}>연속 {streak}푸딩째</span>
          </div>
        </div>

        {/* Center content: greeting + illustration, gap 30 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center', width: '100%' }}>
          {/* Greeting text */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
            {completedCount === 0 && (
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#333d4b', lineHeight: 1.4, textAlign: 'center' }}>
                할 일을 완료하여<br />접시를 채워주세요!
              </p>
            )}
          </div>
          {/* Empty dish or Completed Pudding dish illustration */}
          {completedCount > 0 ? (
            <Tooltip message={completedMessage} placement="top" defaultOpen>
              <img 
                src="/figma-assets/icon/img-pudding-dish.png" 
                alt="completed dish" 
                onClick={handlePuddingClick}
                style={{ 
                  width: 240, 
                  height: 'auto', 
                  display: 'block', 
                  flexShrink: 0,
                  cursor: 'pointer',
                  transform: isBouncing ? 'scale(0.92)' : 'scale(1)',
                  transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                }} 
              />
            </Tooltip>
          ) : (
            <img src='/figma-assets/emptyDish.svg' alt='empty dish' style={{ width: 138.973, height: 62.332, display: 'block', flexShrink: 0 }} />
          )}
        </div>

        {/* Content Area (Empty Card vs List) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 28px', width: '100%' }}>
          {!loaded ? (
             <div style={{ color: '#B0B8C1', textAlign: 'center', padding: 40, fontSize: 14 }}>불러오는 중...</div>
          ) : isEmpty ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ background: '#FFFFFF', width: '100%', display: 'flex', flexDirection: 'column', gap: 21, alignItems: 'center', justifyContent: 'center', minHeight: 74, padding: '32px 8px', borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#191f28', lineHeight: 1.15 }}>아직 접시가 비어있어요!</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.15 }}>오늘 할 일과 보상을 입력해보세요</p>
                </div>
                <button
                  onClick={onAddClick}
                  style={{ background: colors.yellow500, border: 'none', borderRadius: 57, padding: '2px 16px', minHeight: 38, minWidth: 64, color: '#333d4b', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', overflow: 'hidden' }}
                >
                  <span style={{ lineHeight: 1.252 }}>할 일 추가</span>
                  <div style={{ width: 14, height: 14, position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                    <img src='/figma-assets/plusIcon.svg' alt='+' style={{ position: 'absolute', top: '10.83%', right: '10.34%', bottom: '10.83%', left: '11.33%', width: '78.33%', height: '78.34%', display: 'block' }} />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#4E5968', marginBottom: 12, display: 'flex', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4 }}>
                <span>오늘의 할 일</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                {todos.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} onCheck={() => handleCheck(todo)} onDelete={() => handleDelete(todo.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmingTodo}
        onClose={() => setConfirmingTodo(null)}
        title={confirmingTodo ? <>{confirmingTodo.task}<br/>완료하셨나요?</> : "완료하셨나요?"}
        cancelButton={<button onClick={() => setConfirmingTodo(null)} style={{ flex: 1, height: 56, background: '#f2f4f6', color: '#4e5968', border: 'none', borderRadius: 16, fontSize: 17, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>아니오</button>}
        confirmButton={<button onClick={() => confirmingTodo && handleConfirmCheck(confirmingTodo)} style={{ flex: 1, height: 56, background: colors.yellow500, color: '#191f28', border: 'none', borderRadius: 16, fontSize: 17, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>네</button>}
      />
      <AcquiredPopup todo={acquired} onClose={() => setAcquired(null)} />
    </div>
  );
}

/* ─────────────────── Collection Page ─────────────────── */
function getTitle(total: number) {
  if (total === 0) return "갓 구운 푸딩";
  if (total < 5) return "말랑말랑 아기 푸딩";
  if (total < 15) return "달콤함이 솔솔 나는 푸딩";
  if (total < 30) return "모두가 탐내는 달달 푸딩";
  return "전설의 황금 푸딩 👑";
}

function PuddingDetailSheet({ type, todos, onClose }: { type: string; todos: Todo[]; onClose: () => void }) {
  const design = PUDDING_DESIGNS.find(d => d.id === type) || PUDDING_DESIGNS[0];
  const count = todos.length;
  let nextTarget = 5;
  if (count >= 30) nextTarget = 50;
  else if (count >= 15) nextTarget = 30;
  else if (count >= 5) nextTarget = 15;
  const needed = Math.max(0, nextTarget - count);

  return (
    <BottomSheet open={!!type} onClose={onClose}>
      <BottomSheet.Header>
        <div style={{ paddingTop: 16 }}>{design.name} {count}개</div>
      </BottomSheet.Header>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
        <div style={{ width: 160, height: 160, position: 'relative', marginBottom: 20 }}>
          <img src={design.image} alt='pudding' style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 510, color: 'rgba(3,24,50,0.46)', marginBottom: 20 }}>
          다음 레벨까지 {needed}개 더 필요해요
        </div>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40, maxHeight: '50vh', overflowY: 'auto' }}>
        {todos.map(t => {
          const formattedDate = t.date.split('-').slice(1).join('.');
          return (
            <div key={t.id} style={{ background: '#f9fafb', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(0,12,30,0.8)' }}>{t.task}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 510, color: 'rgba(3,24,50,0.46)' }}>{formattedDate}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <img src={design.image} alt='pudding' style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  <span style={{ fontSize: 13, fontWeight: 510, color: 'rgba(3,24,50,0.46)' }}>{t.reward}</span>
                </div>
              </div>
            </div>
          );
        })}
        {todos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: colors.grey500 }}>
            아직 획득한 푸딩이 없어요!
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function calculateStreak(todos: Todo[]) {
  if (todos.length === 0) return 0;
  const getLocalDateStr = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  
  const uniqueDates = Array.from(new Set(todos.map(t => t.date))).sort((a,b) => b.localeCompare(a));
  let streak = 0;
  const todayStr = getLocalDateStr(new Date());
  
  let check = new Date();
  if (uniqueDates[0] !== todayStr) {
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (uniqueDates[0] !== getLocalDateStr(yesterday)) return 0;
    check = yesterday;
  }

  for(let i=0; i<365; i++) {
    const dStr = getLocalDateStr(check);
    if (uniqueDates.includes(dStr)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function CollectionPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  
  useEffect(() => {
    setAllTodos(getCompletedTodos());
    setLoaded(true);
  }, []);

  const total = allTodos.length;
  const streak = calculateStreak(allTodos);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 10 }}>
      <div style={{ padding: "16px 20px 20px" }}>
        
        {loaded && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#191F28", lineHeight: 1.4, marginBottom: 24 }}>
              달달한 성취감이<br />쌓이고 있어요
            </div>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: colors.white, padding: "20px", borderRadius: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {streak > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#8B95A1", display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🔥</span> {streak}일 연속 달콤한 하루!
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 600, color: "#4E5968" }}>
                  <strong style={{ color: "#191F28", fontWeight: 800, fontSize: 18 }}>{total}</strong>개의 푸딩이 쌓였어요
                </div>
              </div>
              <div style={{ display: "flex", position: "relative", height: 40, width: Math.min(total, 5) * 20 + 20 }}>
                {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                  <img key={i} src="/figma-assets/icon/img-pudding-small.svg" alt="pudding" style={{ width: 40, height: 40, objectFit: "contain", position: "absolute", right: i * 20, zIndex: 5 - i }} />
                ))}
                {total === 0 && (
                  <img src="/figma-assets/icon/img-pudding-lock.png" alt="pudding" style={{ width: 40, height: 40, objectFit: "contain", position: "absolute", right: 0, opacity: 0.3 }} />
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 15, fontWeight: 700, color: colors.grey600, marginBottom: 16 }}>푸딩 도감</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {PUDDING_DESIGNS.map(d => {
            const count = allTodos.filter(t => t.puddingType === d.id).length;
            const level = count;
            const isLocked = count === 0;
            return (
              <div key={d.id} onClick={() => !isLocked && setSelectedType(d.id)} style={{ background: isLocked ? "#F9FAFB" : colors.white, borderRadius: 20, padding: "40px 16px 24px", textAlign: "center", cursor: isLocked ? "default" : "pointer", position: "relative", transition: "transform 0.15s" }}>
                {!isLocked && (
                  <div style={{ position: "absolute", top: 14, right: 14, background: "#333D4B", color: colors.white, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 12 }}>
                    Lv.{level}
                  </div>
                )}
                <div style={{ transform: !isLocked ? "scale(1.05)" : "scale(1)" }}>
                  <img src={isLocked ? "/figma-assets/icon/img-pudding-lock.png" : d.image} alt="pudding" style={{ width: 130, height: 130, objectFit: "contain", opacity: isLocked ? 0.5 : 1 }} />
                </div>
                <div style={{ marginTop: 16, fontSize: 15, fontWeight: 700, color: isLocked ? "#8b95a1" : "#191F28" }}>
                  {isLocked ? "아직 비밀인 푸딩" : d.name}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {selectedType && <PuddingDetailSheet type={selectedType} todos={allTodos.filter(t => t.puddingType === selectedType)} onClose={() => setSelectedType(null)} />}
    </div>
  );
}

/* ─────────────────── Tab Bar ─────────────────── */
function TabBar({ tab, onTabChange }: { tab: string; onTabChange: (t: string) => void }) {
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: colors.white, borderRadius: 156, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, padding: "8px 10px", width: 192, boxShadow: "0px 16px 30px rgba(0, 29, 58, 0.18)" }}>
      <div onClick={() => onTabChange("home")} style={{ background: tab === "home" ? "rgba(248,198,0,0.1)" : "transparent", width: 86, padding: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 114, cursor: "pointer", transition: "all 0.2s" }}>
        <div style={{ width: 24, height: 24, position: "relative", marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {tab === "home" ? (
            <img src="/figma-assets/tab-home.svg" alt="home" style={{ width: "80%", height: "80%" }} />
          ) : (
            <img src="/figma-assets/tab-home.svg" alt="home" style={{ width: "80%", height: "80%", filter: "grayscale(100%) opacity(40%)" }} />
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 510, color: tab === "home" ? "#faa131" : "rgba(3,24,50,0.46)", letterSpacing: "-0.2px" }}>홈</span>
      </div>
      
      <div onClick={() => onTabChange("collection")} style={{ background: tab === "collection" ? "rgba(248,198,0,0.1)" : "transparent", width: 86, padding: "5px 6px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 114, cursor: "pointer", transition: "all 0.2s" }}>
        <div style={{ width: 24, height: 24, position: "relative", marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={tab === "collection" ? "/figma-assets/tab-collection-active.svg" : "/figma-assets/tab-collection-inactive.svg"} alt="collection" style={{ width: "90%", height: "90%", objectFit: "contain" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 510, color: tab === "collection" ? "#faa131" : "rgba(3,24,50,0.46)", letterSpacing: "-0.2px" }}>컬렉션</span>
      </div>
    </div>
  );
}

/* ─────────────────── App ─────────────────── */
export default function App() {
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState("home");
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    const todos = loadAll();
    if (todos.length === 0) {
      setScreen("onboarding");
    }
    setLoaded(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  if (!loaded) return null;

  if (screen === "onboarding") return <OnboardingPage onNext={() => setScreen("add")} />;
  if (screen === "add") {
    return <AddTodoPage 
      onAdd={(task, reward, ptype) => {
        addTodo(task, reward, ptype);
        setScreen("home");
        showToast("오늘의 할 일이 추가되었어요! 🍮");
      }} 
      onBack={() => setScreen("home")} 
    />;
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: tab === "home" ? "#EFF0EB" : "#F5F6F3" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", paddingBottom: 100 }}>
        {tab === "home" ? <HomePage onTabChange={setTab} onAddClick={() => setScreen("add")} /> : <CollectionPage />}
      </div>
      <TabBar tab={tab} onTabChange={setTab} />
      
      {/* Global Toast */}
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.8)", color: colors.white, padding: "12px 20px", borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 100, animation: "fadeIn 0.3s ease", pointerEvents: "none" }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
