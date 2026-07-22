import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mixpanel from 'mixpanel-browser';

type TabState = 'home' | 'history';
type ScreenState = 'onboarding' | 'home' | 'breakdown' | 'action' | 'receipt' | 'editSteps';

type Step = {
  id: string;
  text: string;
  completed: boolean;
  timeEstimate: string;
};

const getGoalImage = (category: string) => {
  switch(category) {
    case 'life': return '/assets/img-life.png';
    case 'work': return '/assets/img-work.png';
    case 'habit': return '/assets/img-habit.png';
    case 'study': return '/assets/img-study.png';
    default: return '/assets/img-default.png';
  }
};

const guessCategoryLocally = (text: string) => {
  if (/(운동|산책|청소|정리|빨래|식사|약|물|휴식|일상|수면|잠|여행)/.test(text)) return 'life';
  if (/(업무|메일|보고서|회의|기획|자료|코드|개발|디자인|작업|포트폴리오|수정|작성)/.test(text)) return 'work';
  if (/(공부|학습|강의|책|독서|시험|과제|숙제|영어|단어|수학)/.test(text)) return 'study';
  if (/(취미|명상|피아노|기타|그림|습관|일기|블로그|운동)/.test(text)) return 'habit';
  return 'default';
};

const generateBreakdown = async (goal: string): Promise<{category: string, steps: Step[]}> => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found");
    }

    const prompt = `
사용자가 입력한 목표: "${goal}"

이 목표를 이루기 위한 구체적인 행동 계획을 세워주세요. 다음 규칙을 반드시 지켜주세요:
1. 할 일의 주제를 분석하여 다음 5가지 카테고리 중 하나로 분류해주세요: 'default'(기본), 'life'(일정 및 일상 생활), 'work'(업무 및 작업), 'habit'(취미 및 습관), 'study'(공부).
2. 단계의 개수는 목표의 규모에 따라 유동적으로 정하되, 최소 4개 이상으로 쪼개주세요.
3. 처음 1~2단계는 당장 1분 내외로 끝낼 수 있는 아주 가볍고 쉬운 행동(예: '책상 앞에 앉기', '노트북 켜기')으로 배치해서 시작의 허들을 낮춰주세요.
4. 3~4번째 단계부터는 실제로 목표를 달성하기 위한 구체적이고 현실적인 행동(10분~30분 이상 소요)으로 길게 가져가 주세요. 너무 비현실적으로 짧은 행동만 반복하지 마세요.
5. 반드시 JSON 형식으로 응답해주세요. 최상위는 'category' (문자열)와 'steps' (행동 객체 배열) 두 가지 속성을 가져야 합니다. 각 행동 객체는 'text'(행동 설명, 30자 이내), 'timeEstimate'(예상 소요 시간, 예: '1분', '20분') 두 가지 속성을 가져야 합니다.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING", enum: ["default", "life", "work", "habit", "study"], description: "할 일 유형" },
              steps: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    text: { type: "STRING", description: "행동 설명 (20자 이내)" },
                    timeEstimate: { type: "STRING", description: "예상 소요 시간 (예: '1분', '5분')" }
                  },
                  required: ["text", "timeEstimate"]
                }
              }
            },
            required: ["category", "steps"]
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "API request failed");
    }

    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const jsonStr = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(jsonStr);
      
      const steps = parsed.steps.map((s: any, idx: number) => ({
        id: String(idx + 1),
        text: s.text || '다음 단계 진행하기',
        timeEstimate: s.timeEstimate || '5분',
        completed: false
      }));
      return { category: parsed.category || 'default', steps };
    }
    throw new Error("Invalid response format from AI");
  } catch (error) {
    console.error("AI Breakdown Error:", error);
    return {
      category: 'default',
      steps: [
        { id: "1", text: `[에러] ${error.message || '알 수 없는 오류'}`, timeEstimate: '1분', completed: false },
        { id: "2", text: '관련 자료나 도구 눈앞에 두기', timeEstimate: '2분', completed: false },
        { id: "3", text: '5분 타이머 맞추기', timeEstimate: '1분', completed: false },
        { id: "4", text: '무작정 시작해보기', timeEstimate: '5분', completed: false },
      ]
    };
  }
};


const simulateMicroBreakdown = (): Promise<string> => {
  return new Promise(resolve => {
    setTimeout(() => resolve('노트북 가방 지퍼 열기'), 800);
  });
};

export default function App() {
  const [tab, setTab] = useState<TabState>('home');
  const [screen, setScreen] = useState<ScreenState>(() => {
    return localStorage.getItem('doit_goal') ? 'home' : 'onboarding';
  });
  
  const [goal, setGoal] = useState(() => localStorage.getItem('doit_goal') || '');
  const [steps, setSteps] = useState<Step[]>(() => {
    const saved = localStorage.getItem('doit_steps');
    return saved ? JSON.parse(saved) : [];
  });
  const [isMicroBreaking, setIsMicroBreaking] = useState(false);
  const [history, setHistory] = useState<{id: number, text: string, date: string, steps?: Step[], when?: string, where?: string, status?: 'complete' | 'incomplete', category?: string}[]>(() => {
    const saved = localStorage.getItem('doit_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<{id: number, text: string, date: string, steps?: Step[], when?: string, where?: string, category?: string} | null>(null);
  const [goalCategory, setGoalCategory] = useState<string>(() => {
    return localStorage.getItem('doit_goalCategory') || 'default';
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isAddStepSheetOpen, setIsAddStepSheetOpen] = useState(false);
  const [newStepText, setNewStepText] = useState('');
  const [newStepTime, setNewStepTime] = useState('5 min');
  const [postItColor, setPostItColor] = useState(() => localStorage.getItem('doit_postItColor') || '#FAE588');
  const [startWhen, setStartWhen] = useState(() => localStorage.getItem('doit_startWhen') || '');
  const [startWhere, setStartWhere] = useState(() => localStorage.getItem('doit_startWhere') || '');
  const [isFeedbackPopupOpen, setIsFeedbackPopupOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [isHomeCalendarSheetOpen, setIsHomeCalendarSheetOpen] = useState(false);
  const [homeCalendarSheetDate, setHomeCalendarSheetDate] = useState(new Date());
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  useEffect(() => {
    // TODO: Replace YOUR_MIXPANEL_TOKEN with actual project token
    mixpanel.init("YOUR_MIXPANEL_TOKEN", { debug: true, track_pageview: true, persistence: 'localStorage' });
  }, []);

  useEffect(() => {
    localStorage.setItem('doit_goal', goal);
    localStorage.setItem('doit_goalCategory', goalCategory);
    localStorage.setItem('doit_steps', JSON.stringify(steps));
    localStorage.setItem('doit_history', JSON.stringify(history));
    localStorage.setItem('doit_postItColor', postItColor);
    localStorage.setItem('doit_startWhen', startWhen);
    localStorage.setItem('doit_startWhere', startWhere);
  }, [goal, goalCategory, steps, history, postItColor, startWhen, startWhere]);
  
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);
  
  const [currentActionStepIndex, setCurrentActionStepIndex] = useState(0);
  
  const handleStartAction = () => {
    setActionStartTime(new Date());
    setCurrentActionStepIndex(0);
    setScreen('action');
  };
  const [bottomSheetStep, setBottomSheetStep] = useState<1 | 2>(1);
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [isAnimatingNext, setIsAnimatingNext] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [isStopPopupOpen, setIsStopPopupOpen] = useState(false);
  const [showBreakdownToast, setShowBreakdownToast] = useState(false);
  const [breakdownToastMessage, setBreakdownToastMessage] = useState('');
  const [homeDate, setHomeDate] = useState<Date>(new Date());
  const [checkParticles, setCheckParticles] = useState<any[]>([]);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<number | 'new' | null>(null);
  const [pickerScrollValue, setPickerScrollValue] = useState<string>('5 min');

  // editSteps hooks
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const initialPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (screen !== 'action') {
      setShowActionPopup(false);
    }
  }, [screen]);

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setSteps(newSteps);
  };

  const updateStepText = (index: number, newText: string) => {
    const newSteps = [...steps];
    newSteps[index].text = newText;
    setSteps(newSteps);
  };

  // --- Screens ---

  const renderOnboarding = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', minHeight: '100vh', background: '#FFF', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes flutter {
          0% { transform: translateY(0px) rotate(-4deg); box-shadow: 2px 8px 15px rgba(0,0,0,0.1); }
          50% { transform: translateY(-12px) rotate(3deg); box-shadow: 6px 15px 20px rgba(0,0,0,0.08); }
          100% { transform: translateY(0px) rotate(-4deg); box-shadow: 2px 8px 15px rgba(0,0,0,0.1); }
        }
      `}</style>
      
      {/* Top Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12vh', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <h1 style={{ fontSize: 50, fontWeight: 800, fontFamily: "'Lexend', sans-serif", color: '#191f28', margin: 0, lineHeight: 1.2 }}>
            DO IT
          </h1>
          <span style={{ fontSize: 50, fontWeight: 800, fontFamily: "'Lexend', sans-serif", color: '#191f28', transform: 'rotate(15deg)', display: 'inline-block', lineHeight: 1.2 }}>!</span>
        </div>
        <p style={{ fontSize: 18, fontWeight: 500, color: 'rgba(3,18,40,0.7)', margin: 0, marginTop: 8, lineHeight: 1.5 }}>
          하루 한 가지만 시작하기
        </p>
      </div>

      {/* Middle Graphic Section */}
      <div style={{ width: '100%', maxWidth: 300, height: 300, backgroundColor: '#f2f4f6', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* Fluttering Post-it */}
        <div style={{ 
          width: 140, height: 160, backgroundColor: '#fae588', 
          border: '1.5px solid #000', borderRadius: 4,
          animation: 'flutter 3.5s ease-in-out infinite',
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, boxSizing: 'border-box'
        }}>
          {/* Post-it Tape */}
          <div style={{ position: 'absolute', top: -12, width: 45, height: 24, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2, transform: 'rotate(-2deg)', border: '1px solid rgba(0,0,0,0.05)' }} />
          
          {/* Mock Lines */}
          <div style={{ marginTop: 20, width: '100%', height: 3, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, marginBottom: 12 }} />
          <div style={{ width: '80%', alignSelf: 'flex-start', height: 3, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, marginBottom: 12 }} />
          <div style={{ width: '60%', alignSelf: 'flex-start', height: 3, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2 }} />
          

        </div>
      </div>

      {/* Bottom CTA Area */}
      <div style={{ position: 'absolute', bottom: 50, left: 20, right: 20, display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={() => setScreen('home')}
          style={{ 
            backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12,
            width: '100%', maxWidth: 335, padding: '13.5px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', transition: 'transform 0.1s'
          }}
          className="neo-btn"
        >
          <span style={{ fontSize: 18, fontWeight: 600, color: '#130537', lineHeight: 1.5 }}>시작하기</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#130537" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path>
            <path d="M12 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    </div>
  );

  const renderBackButton = (onBack: () => void) => (
    <button 
      onClick={onBack}
      style={{ 
        background: 'transparent', border: 'none', 
        width: 40, height: 40, fontSize: 24, cursor: 'pointer', 
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
        marginBottom: 10, padding: 0
      }}
    >
      <img src="/assets/icon-arrow-back.svg" alt="뒤로가기" style={{ width: 24, height: 24 }} />
    </button>
  );

  const QUOTES = [
    { text: "시작이 반이다.", author: "아리스토텔레스" },
    { text: "행동은 모든 성공의 가장 기초적인 핵심이다.", author: "파블로 피카소" },
    { text: "작은 일도 시작해야 위대한 일도 생긴다.", author: "마크 샌번" },
    { text: "목표에 도달하는 유일한 방법은 첫걸음을 떼는 것이다.", author: "노자" },
    { text: "아무것도 하지 않으면 아무 일도 일어나지 않는다.", author: "기시미 이치로" },
    { text: "완벽주의는 행동의 적이다. 일단 시작하라.", author: "마크 트웨인" },
    { text: "지금 적극적으로 실행되는 좋은 계획이 다음 주의 완벽한 계획보다 낫다.", author: "조지 S. 패튼" }
  ];

  const renderHome = () => {
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    const y = homeDate.getFullYear();
    const m = String(homeDate.getMonth() + 1).padStart(2, '0');
    const d = String(homeDate.getDate()).padStart(2, '0');
    const dateString = `${y}/${m}/${d}`;

    const startOfYear = new Date(homeDate.getFullYear(), 0, 0);
    const diff = homeDate.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const currentQuote = QUOTES[dayOfYear % QUOTES.length];

    const isToday = homeDate.toLocaleDateString() === todayDate.toLocaleDateString();
    const historyItem = history.find(h => h.date === homeDate.toLocaleDateString('en-US'));
    const isFinishedDay = historyItem ? historyItem.status === 'complete' : false;

    const displayGoal = historyItem ? historyItem.text : (isToday ? goal : '');
    const displaySteps = historyItem ? (historyItem.steps || []) : (isToday ? steps : []);
    const displayCategory = historyItem ? (historyItem.category || 'default') : (isToday ? goalCategory : 'default');

    const hasActiveGoal = displayGoal.trim().length > 0;
    const completedCount = displaySteps.filter(s => s.completed).length;
    const totalCount = displaySteps.length;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const allCompleted = totalCount > 0 && completedCount === totalCount;
    const nextStepIndex = displaySteps.findIndex(s => !s.completed);
    const nextStep = nextStepIndex !== -1 ? displaySteps[nextStepIndex] : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>

        {/* Date Header Wrapper */}
        <div style={{ width: '100%', maxWidth: 375, padding: '20px 20px 0 20px', display: 'flex', justifyContent: 'flex-start' }}>
          <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => {
              setHomeCalendarSheetDate(homeDate);
              setIsHomeCalendarSheetOpen(true);
            }}
          >
            <h1 style={{ fontSize: 16, fontWeight: 400, color: '#191f28', margin: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Lexend', sans-serif" }}>
              {dateString} <img src="/assets/icon-bottom.svg" alt="" style={{ width: 14, height: 14, marginLeft: 2 }} />
            </h1>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ width: '100%', maxWidth: 335, textAlign: 'left', marginBottom: 32, marginTop: 16 }}>
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            border: '1.5px solid rgba(0,12,30,0.8)', 
            borderRadius: '30px 30px 30px 6px', 
            padding: '12px 24px', backgroundColor: '#FFF' 
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, marginRight: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,12,30,0.8)', margin: 0, wordBreak: 'keep-all', lineHeight: 1.5 }}>
                {currentQuote.text}
              </p>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5 }}>{currentQuote.author}</span>
            </div>
            <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', backgroundColor: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2, boxSizing: 'border-box' }}>
              <img src="/assets/img-character.png" alt="캐릭터" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
        </div>
        
        <div style={{ width: '100%', maxWidth: 375, display: 'flex', flexDirection: 'column', alignItems: 'center', position: isBottomSheetOpen ? 'relative' : 'static', zIndex: isBottomSheetOpen ? 2001 : 'auto' }}>
          {/* Post-it UI Goal Card */}
          <div style={{ 
            position: 'relative', paddingTop: 36, width: '100%', display: 'flex', justifyContent: 'center',
            transform: isBottomSheetOpen ? 'translateY(-130px) scale(0.85)' : 'translateY(0) scale(1)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top center'
          }}>
            <div 
              style={{ 
                position: 'relative', width: 220, height: 260, backgroundColor: isToday ? ((hasActiveGoal || isBottomSheetOpen) ? postItColor : '#FAE588') : (historyItem?.status === 'incomplete' ? '#D1D6DB' : '#FAE588'), 
                border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 6,
                boxShadow: '0px 8px 7.5px rgba(22,22,22,0.13)',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 16
              }}
            >
              {/* Top Masking Tape */}
              <div style={{
                position: 'absolute', top: -12.5, left: '50%', transform: 'translateX(-50%)',
                width: 100, height: 20, backgroundColor: 'rgba(255,255,255,0.7)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }} />

              {/* Top Left Date */}
              <div style={{ position: 'absolute', top: 16.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 38, fontWeight: 300, lineHeight: 1.2, color: 'rgba(0,12,30,0.8)', fontFamily: "'Lexend', sans-serif" }}>{d}</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(0,12,30,0.8)', fontFamily: "'Lexend', sans-serif" }}>
                  {todayDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                </span>
              </div>

              {/* Top Right Illustration */}
              <div style={{ position: 'absolute', top: 10, right: 10, width: 70, height: 70 }}>
                <img src={getGoalImage(displayCategory)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              {!hasActiveGoal && !displayGoal.trim() ? (
                <div style={{ position: 'absolute', top: 110.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: 'rgba(3,24,50,0.46)' }}>
                  {isToday ? (
                    <>
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>오늘 꼭 해야 할</span>
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>한가지 일을 적어주세요</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>이 날은 기록이 없어요</span>
                  )}
                </div>
              ) : (
                <div style={{ position: 'absolute', top: 100.5, left: 16.5, width: 187, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <h1 style={{ fontSize: 20, fontWeight: 600, color: '#191f28', margin: 0, wordBreak: 'break-word', textAlign: 'left', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {displayGoal}
                  </h1>
                </div>
              )}
              
              {isBottomSheetOpen && (
                <div style={{ position: 'absolute', bottom: 12, right: 16, color: 'rgba(3,24,50,0.46)', fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>
                  최대 30글자
                </div>
              )}
              
              {historyItem?.status === 'complete' && (
                <div style={{ 
                  position: 'absolute', bottom: 16, right: 16, 
                  backgroundColor: '#191f28', borderRadius: 30, padding: '4px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontFamily: 'Pretendard', fontWeight: 500, fontSize: 14, color: '#FFF', lineHeight: 1.5 }}>완료</span>
                </div>
              )}
            </div>
          </div>

          {/* Plus FAB Button */}
          {!hasActiveGoal && isToday && !isFinishedDay && (

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 28 }}>
              <button
                onClick={() => {
                  setIsBottomSheetOpen(true);
                  setBottomSheetStep(1);
                }}
                style={{
                  width: 48, height: 48, backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)',
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0
                }}
              >
                <img src="/assets/icon-plus.svg" alt="" style={{ width: 20, height: 20 }} />
              </button>
            </div>
          )}
          {hasActiveGoal && <div style={{ height: 28 }} />}

          {/* Dynamic Bottom Area */}
          {!hasActiveGoal ? null : (
            <>
              {isFinishedDay ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 20, padding: '0 20px', boxSizing: 'border-box' }}>
                  <div style={{ 
                    backgroundColor: '#FFF', border: '1.5px solid #130537', borderRadius: 12,
                    padding: '13.5px 17.5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', boxSizing: 'border-box'
                  }}>
                    <span style={{ fontFamily: 'Pretendard', fontWeight: 500, fontSize: 16, color: 'rgba(0,12,30,0.8)', lineHeight: 1.5 }}>
                      오늘 할 일을 모두 완료했어요!
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress and Next Action Section */}
                  <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                    
                    {/* Progress Bar Container */}
                    <div style={{ width: '100%', marginBottom: 24, marginTop: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
                      
                      {/* Track */}
                      <div style={{ flex: 1, position: 'relative', height: 12, backgroundColor: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 20 }}>
                        <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#c5e3ff', borderRadius: 20, borderRight: progress < 100 && progress > 0 ? '1.5px solid rgba(0,12,30,0.8)' : 'none', transition: 'width 0.3s ease' }} />
                        
                        {/* Tooltip */}
                        <div style={{
                          position: 'absolute', top: -38, left: `calc(${Math.max(15, Math.min(85, progress))}%)`, transform: 'translateX(-50%)',
                          backgroundColor: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 20, padding: '4px 12px',
                          fontSize: 12, fontWeight: 600, color: 'rgba(0,12,30,0.8)', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontFamily: "'Pretendard', sans-serif"
                        }}>
                          여기까지 했어요
                          <div style={{
                            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                            width: 8, height: 8, backgroundColor: '#FFF', borderBottom: '1.5px solid rgba(0,12,30,0.8)', borderRight: '1.5px solid rgba(0,12,30,0.8)'
                          }} />
                        </div>
                      </div>

                      {/* Arrow Icon */}
                      <svg onClick={() => setScreen('breakdown')} style={{ cursor: 'pointer', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,12,30,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </div>

                    {/* Next Action Box */}
                    {!allCompleted && nextStep && (
                      <div style={{ 
                        width: '100%', padding: '14px 16px', backgroundColor: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12, 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden', marginRight: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(3,24,50,0.46)', whiteSpace: 'nowrap', fontFamily: "'Pretendard', sans-serif" }}>다음</span>
                          <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,12,30,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Pretendard', sans-serif" }}>{nextStep.text}</span>
                        </div>
                        <div 
                          onClick={() => {
                            if (completedCount === 0) setActionStartTime(new Date());
                            setScreen('action');
                          }}
                          style={{ 
                            backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 20, 
                            padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#130537', fontFamily: "'Pretendard', sans-serif" }}>{completedCount > 0 ? '이어서 하기' : '시작하기'}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#130537" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </>
          )}
        </>
      )}
        </div>
      </div>
    );
  };

  const renderBottomSheet = () => (
    <>
      <div 
        onClick={() => setIsBottomSheetOpen(false)}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)', zIndex: 2000,
        }}
      />
      <div 
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 375,
          backgroundColor: '#FFF', borderTopLeftRadius: 34, borderTopRightRadius: 34,
          padding: '16px 20px 20px', zIndex: 2002,
          animation: 'slideUpCentered 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh', overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 4, backgroundColor: '#E5E8EB', borderRadius: 40 }} />
        </div>
        
        {bottomSheetStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Post-it Color Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(3,18,40,0.7)', marginLeft: 4, lineHeight: 1.5 }}>포스트잇 색상</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {['#FAE588', '#C8E2FA', '#C4B5FD', '#A7F3D0', '#FCA5A5', '#FCE7F3'].map(color => (
                  <div 
                    key={color}
                    onClick={() => setPostItColor(color)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', backgroundColor: color,
                      border: postItColor === color ? '2px solid #000' : 'none',
                      cursor: 'pointer', boxSizing: 'border-box'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Goal Input Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(3,18,40,0.7)', marginLeft: 4, lineHeight: 1.5 }}>오늘 할 일</div>
              
              <input
                placeholder="오늘 꼭 할 일 한가지를 입력하세요"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                maxLength={30}
                style={{ 
                  width: '100%', border: '1.5px solid #B0B8C1', borderRadius: 12, padding: '13.5px 17.5px',
                  outline: 'none', fontSize: 16, fontWeight: 400, color: '#191f28', boxSizing: 'border-box', lineHeight: 1.5
                }}
              />
              
              {goal.length > 0 && goal.trim().length < 5 && (
                <div style={{ fontSize: 12, color: '#EF4444', marginLeft: 4, marginTop: -4, lineHeight: 1.5 }}>
                  5글자 이상 작성해주세요.
                </div>
              )}

              {/* Suggestion Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {["포트폴리오 완성하기", "시험 공부하기", "방 청소하기", "발표 자료 만들기", "면접 준비하기"].map(chip => (
                  <div
                    key={chip}
                    onClick={() => setGoal(chip)}
                    style={{
                      backgroundColor: '#F2F4F6', borderRadius: 8, padding: '4px 12px', height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', cursor: 'pointer', lineHeight: 1.5
                    }}
                  >
                    {chip}
                  </div>
                ))}
              </div>
            </div>

            {/* Done Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
              <div 
                onClick={async () => {
                  if (goal.trim().length < 5) return;
                  
                  setIsBottomSheetOpen(false);
                  setScreen('breakdown');
                  setGoalCategory(guessCategoryLocally(goal)); // Guess category locally first so image updates immediately
                  setIsGeneratingSteps(true);
                  setBreakdownToastMessage('할 일을 단계별로 쪼개고 있어요.');
                  setShowBreakdownToast(true);
                  
                  let toggle = false;
                  const messageInterval = setInterval(() => {
                    toggle = !toggle;
                    setBreakdownToastMessage(toggle ? '잠시만 기다려주세요!' : '할 일을 단계별로 쪼개고 있어요.');
                  }, 5500);

                  try {
                    const result = await generateBreakdown(goal);
                    setSteps(result.steps);
                    setGoalCategory(result.category);
                    mixpanel.track('Set Goal', { goal: goal, category: result.category, stepsCount: result.steps.length });
                  } finally {
                    clearInterval(messageInterval);
                    setIsGeneratingSteps(false);
                    setBreakdownToastMessage('오늘의 할 일을 단계별로 정리했어요 ✨');
                    setTimeout(() => setShowBreakdownToast(false), 3000);
                  }
                }}
                style={{ 
                  backgroundColor: goal.trim().length >= 5 ? '#c5e3ff' : '#E5E8EB',
                  border: goal.trim().length >= 5 ? '1.5px solid rgba(0,12,30,0.8)' : '1.5px solid #8B95A1',
                  borderRadius: 12, padding: '13.5px 0',
                  width: '100%', textAlign: 'center', fontSize: 18, fontWeight: 600, lineHeight: 1.5,
                  color: goal.trim().length >= 5 ? '#130537' : 'rgba(3,24,50,0.46)',
                  cursor: goal.trim().length >= 5 ? 'pointer' : 'not-allowed'
                }}
              >
                완료
              </div>
            </div>
          </div>
        )}


      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );

  const renderBreakdown = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#FFF' }}>
      {/* Top Navigation */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '10px 20px', boxSizing: 'border-box' }}>
        <button 
          onClick={() => setScreen('home')}
          style={{ 
            width: 34, height: 34, borderRadius: '50%', background: '#FFF', border: '1.5px solid rgba(3,18,40,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
          }}
        >
          <img src="/assets/icon-arrow-back.svg" alt="뒤로가기" style={{ width: 20, height: 20, marginRight: 2 }} />
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 375, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 40px' }}>
        {/* Title Area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>오늘의 할 일</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'rgba(0,12,30,0.8)', lineHeight: 1.5 }}>{goal || "포트폴리오 수정 완료하기"}</div>
        </div>
        
        {/* Illustration */}
        <div style={{ width: 139, height: 139, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
          <img src={getGoalImage(goalCategory)} alt="노트북" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>


        {/* Steps List or Skeleton */}
        {isGeneratingSteps ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{ height: 61, borderRadius: 12, width: '100%' }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, idx) => {
                const isCurrentAction = idx === currentActionStepIndex;
                return (
                  <div 
                    key={step.id} 
                    style={{ 
                      position: 'relative',
                      backgroundColor: isCurrentAction ? '#FAE588' : '#FFF', 
                      border: isCurrentAction ? '1.5px solid #130537' : '1.5px solid rgba(0,25,54,0.31)',
                      borderRadius: 12, 
                      padding: '13.5px 17.5px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      opacity: 0,
                      animation: 'fadeInUp 0.4s ease-out forwards',
                      animationDelay: `${idx * 0.15}s`
                    }}
                  >
                    {/* Tooltip for the current action item */}
                    {isCurrentAction && (
                      <div style={{
                        position: 'absolute', top: -18, left: 16,
                        backgroundColor: '#FFF', border: '1.5px solid #130537', borderRadius: 14,
                        padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#191f28', lineHeight: 1.5 }}>
                          {step.timeEstimate ? `${step.timeEstimate.replace(/[^0-9]/g, '')}분이면 돼요` : '2분이면 돼요'}
                        </span>
                      </div>
                    )}

                    {/* Left part: Number and Text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
                      <div style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>{idx + 1}</span>
                      </div>
                      <div style={{ 
                        fontSize: 16, fontWeight: 500, color: isCurrentAction ? 'rgba(0,12,30,0.8)' : 'rgba(3,18,40,0.7)', 
                        lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                      }}>
                        {step.text}
                      </div>
                    </div>

                    {/* Right part: Divider, Clock Icon, Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ width: 1, height: 26, backgroundColor: isCurrentAction ? 'rgba(19,5,55,0.2)' : 'rgba(0,25,54,0.1)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(3,24,50,0.46)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5, fontFamily: 'Lexend, sans-serif' }}>
                          {step.timeEstimate.replace('분', ' min')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Plus Button */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <button 
                onClick={() => {
                  setNewStepText('');
                  setNewStepTime('1분');
                  setIsAddStepSheetOpen(true);
                }}
                style={{ 
                  width: 37, height: 37, borderRadius: 8, backgroundColor: 'transparent', border: '1.5px solid rgba(0,25,54,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,12,30,0.8)" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Breakdown Toast */}
      {showBreakdownToast && (
        <div style={{
          position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)',
          padding: '16px 20px', backgroundColor: 'rgba(3,24,50,0.92)', color: '#FFF', borderRadius: 16,
          fontSize: 14, fontWeight: 500, lineHeight: 1.5, zIndex: 1000, animation: 'toastEnter 0.3s ease-out',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'
        }}>
          {isGeneratingSteps && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {breakdownToastMessage}
        </div>
      )}

      {/* Bottom CTA (Start & Edit) */}
      {!isGeneratingSteps && (
        <div style={{ position: 'sticky', bottom: 0, width: '100%', padding: '20px', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 20%)', zIndex: 100, boxSizing: 'border-box', marginTop: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 335, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button 
              onClick={handleStartAction}
              style={{ 
                flex: 1,
                background: '#c5e3ff',
                border: '1.5px solid rgba(0,12,30,0.8)',
                borderRadius: 12,
                height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none'
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 600, color: '#130537' }}>
                {currentActionStepIndex > 0 ? '이어서 하기' : '행동 시작하기'}
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#130537" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button 
              onClick={() => setScreen('editSteps')}
              style={{ 
                width: 54, height: 54, flexShrink: 0,
                background: '#2A303C', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 27,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <img src="/assets/icon-edit.svg" alt="수정" style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
  const renderEditSteps = () => {

    const handlePointerDown = (e: React.TouchEvent | React.MouseEvent, index: number) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'button' || target.closest('button')) {
        return;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      initialPointer.current = { x: clientX, y: clientY };

      const timer = setTimeout(() => {
        setDraggedIndex(index);
        setDragStartY(clientY);
        setDragOffset(0);
        document.body.style.overflow = 'hidden';
      }, 150); // 150ms long press
      setLongPressTimer(timer);
    };

    const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
      if (draggedIndex === null) {
        if (longPressTimer) {
          const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
          const dx = clientX - initialPointer.current.x;
          const dy = clientY - initialPointer.current.y;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
          }
        }
        return;
      }

      if (e.cancelable) e.preventDefault();

      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      const offset = clientY - dragStartY;
      setDragOffset(offset);

      const itemHeight = 90; // Approx height including gap
      // Use Math.trunc so the user has to drag further (a full item height) to trigger a swap
      const swapIndex = draggedIndex + Math.trunc(offset / itemHeight);
      
      if (swapIndex >= 0 && swapIndex < steps.length && swapIndex !== draggedIndex) {
        const newSteps = [...steps];
        const temp = newSteps[draggedIndex];
        newSteps[draggedIndex] = newSteps[swapIndex];
        newSteps[swapIndex] = temp;
        setSteps(newSteps);
        setDraggedIndex(swapIndex);
        setDragStartY(clientY);
        setDragOffset(0);
      }
    };

    const handlePointerUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      setDraggedIndex(null);
      setDragOffset(0);
      document.body.style.overflow = 'auto';
    };

    const handleDelete = (index: number) => {
      const newSteps = steps.filter((_, i) => i !== index);
      setSteps(newSteps);
    };

    const handleTextChange = (index: number, value: string) => {
      const newSteps = [...steps];
      newSteps[index].text = value;
      setSteps(newSteps);
    };

    const handleTimeChange = (index: number, value: string) => {
      const newSteps = [...steps];
      newSteps[index].timeEstimate = value;
      setSteps(newSteps);
    };

    return (
      <div 
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#FFFFFF', position: 'relative' }}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onMouseLeave={handlePointerUp}
      >
        {/* Top Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 30, paddingLeft: 20, paddingRight: 20, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Pretendard', fontWeight: 500, fontSize: 14, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>
                오늘의 할 일
              </div>
              <div style={{ fontFamily: 'Pretendard', fontWeight: 600, fontSize: 20, color: 'rgba(0,12,30,0.8)', lineHeight: 1.5 }}>
                {goal}
              </div>
            </div>
            <div style={{ width: 139, height: 139, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <img src={getGoalImage(goalCategory)} alt="pc" className="anim-float" style={{ width: '100%', objectFit: 'contain' }} />
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div ref={listRef} style={{ width: '100%', maxWidth: 375, display: 'flex', flexDirection: 'column', padding: '20px 20px 100px', boxSizing: 'border-box', touchAction: draggedIndex !== null ? 'none' : 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                onMouseDown={(e) => handlePointerDown(e, idx)}
                onTouchStart={(e) => handlePointerDown(e, idx)}
                style={{ 
                  display: 'flex', flexDirection: 'column', padding: '13.5px 17.5px', 
                  backgroundColor: '#F9FAFB', borderRadius: 12, border: '1.5px solid rgba(0,25,54,0.31)',
                  transform: draggedIndex === idx ? `translateY(${dragOffset}px) scale(1.02)` : 'none',
                  zIndex: draggedIndex === idx ? 100 : 1,
                  boxShadow: draggedIndex === idx ? '0px 8px 16px rgba(0,0,0,0.1)' : 'none',
                  transition: draggedIndex === idx ? 'none' : 'transform 0.2s, box-shadow 0.2s',
                  cursor: draggedIndex === idx ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
              >
                {/* Top Row: Number, Input, Time */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', borderRadius: 53, width: 18, height: 18, boxSizing: 'border-box' }}>
                      <span style={{ fontFamily: 'Pretendard', fontWeight: 500, fontSize: 14, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>
                        {idx + 1}
                      </span>
                    </div>
                    <div style={{ flex: 1, borderBottom: '1.5px solid #D1D6DB', padding: '6px 0', display: 'flex', alignItems: 'center' }}>
                      <input 
                        value={step.text} 
                        onChange={(e) => handleTextChange(idx, e.target.value)}
                        placeholder=""
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Pretendard', fontWeight: 500, fontSize: 16, color: 'rgba(0,12,30,0.8)' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingLeft: 12 }}>
                    <div 
                      onClick={() => {
                        setTimePickerTarget(idx);
                        setIsTimePickerOpen(true);
                      }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <img src="/assets/icon-clock.svg" alt="clock" style={{ width: 16, height: 16, opacity: 0.5 }} />
                      <div style={{ width: '100%', borderBottom: '1px solid transparent' }}>
                        <span style={{ fontFamily: 'Lexend', fontSize: 12, color: 'rgba(3,24,50,0.46)', textAlign: 'center' }}>
                          {(step.timeEstimate || '25 min').replace('분', ' min')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Bottom Row: Delete */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8 }}>
                  <button onClick={() => handleDelete(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                    <span style={{ fontFamily: 'Pretendard', fontWeight: 500, fontSize: 16, color: '#F66570', lineHeight: 1.5 }}>삭제</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F66570" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, padding: '30px 20px', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 27%)', zIndex: 100, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button 
              onClick={() => setScreen('breakdown')}
              style={{ 
                flex: 1, background: '#C5E3FF', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12,
                padding: '13.5px 9.5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontFamily: 'Pretendard', fontSize: 18, fontWeight: 600, color: '#130537'
              }}
            >
              완료
            </button>
            <button 
              onClick={() => setIsAddStepSheetOpen(true)}
              style={{ 
                width: 54, height: 54, flexShrink: 0, background: '#333D4B', borderRadius: 72,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAction = () => {
    const currentStep = steps[currentActionStepIndex];
    const nextStep = steps[currentActionStepIndex + 1];

    const timeString = actionStartTime 
      ? actionStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const handleNext = () => {
      const fixedConfigs = [
        { left: '64%', endX: '-20px', startRot: '-20deg', endRot: '-40deg', delay: '0s' },
        { left: '70%', endX: '0px', startRot: '0deg', endRot: '15deg', delay: '0.05s' },
        { left: '76%', endX: '20px', startRot: '20deg', endRot: '45deg', delay: '0.1s' }
      ];
      const newParticles = fixedConfigs.map((config, i) => ({
        id: Date.now() + i,
        ...config
      }));
      setCheckParticles(prev => [...prev, ...newParticles]);
      setTimeout(() => {
        setCheckParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
      }, 1000);

      // Mark current as completed
      const newSteps = [...steps];
      if (newSteps[currentActionStepIndex]) {
        newSteps[currentActionStepIndex].completed = true;
      }
      setSteps(newSteps);
      
      mixpanel.track('Complete Step', { 
        stepIndex: currentActionStepIndex, 
        stepText: newSteps[currentActionStepIndex]?.text,
        goal: goal
      });

      if (currentActionStepIndex < steps.length - 1) {
        // Move to next step
        setCurrentActionStepIndex(currentActionStepIndex + 1);
        setActionStartTime(new Date());
      } else {
        // Finished all steps
        mixpanel.track('Finish All Steps', { goal: goal, totalSteps: steps.length });
        setShowActionPopup(true);
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#FFF', position: 'relative' }}>
        {/* Top Navigation */}
        <div style={{ width: '100%', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box' }}>
          <button 
            onClick={() => setIsStopPopupOpen(true)}
            style={{ 
              width: 34, height: 34, borderRadius: '50%', background: '#FFF', border: '1.5px solid rgba(3,18,40,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
            }}
          >
            <img src="/assets/icon-arrow-back.svg" alt="뒤로가기" style={{ width: 20, height: 20, marginRight: 2 }} />
          </button>

          {/* Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {steps.map((_, idx) => (
              <div 
                key={idx}
                style={{
                  height: 6,
                  borderRadius: 6,
                  backgroundColor: idx === currentActionStepIndex ? '#6b7684' : '#E5E8EB',
                  width: idx === currentActionStepIndex ? 16 : 6,
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>

          <div style={{ backgroundColor: '#f2f4f6', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#6b7684', lineHeight: 1.5 }}>{currentActionStepIndex + 1}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#b0b8c1', lineHeight: 1.5 }}>/{steps.length}</span>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, paddingBottom: 150 }}>
          {/* Layered Card Container (No animation here) */}
          <div 
            key={currentActionStepIndex}
            style={{ 
              position: 'relative', width: 315, height: 257, marginBottom: 36
            }}
          >
            {/* Background Blue Card */}
            <div style={{ 
              position: 'absolute', top: 11, left: 7, width: 315, height: 257,
              backgroundColor: '#c5e3ff', border: '1.5px solid #000', borderRadius: 14, zIndex: 1
            }} />
            
            {/* Foreground White Card */}
            <div style={{ 
              position: 'absolute', top: 0, left: 0, width: 315, height: 257,
              backgroundColor: '#FFF', border: '1.5px solid #000', borderRadius: 14, zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px',
              transformOrigin: 'bottom center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, marginBottom: 25, marginTop: 25 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', letterSpacing: '-0.28px', lineHeight: 1.5 }}>
                  지금 이것만 해볼까요?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#191f28', letterSpacing: '-0.48px', wordBreak: 'keep-all', textAlign: 'center', lineHeight: 1.4 }}>
                    {currentStep?.text || '알 수 없는 작업'}
                  </div>
                  <div style={{ backgroundColor: '#f2f4f6', padding: '4px 6px', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5 }}>
                      {currentStep?.timeEstimate || '1분'}이면 충분해요
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(3,24,50,0.46)', letterSpacing: '-0.11px', fontFamily: 'Lexend, sans-serif' }}>
                  STARTED
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(0,12,30,0.8)', letterSpacing: '-0.15px', fontFamily: 'Lexend, sans-serif' }}>
                  {timeString}
                </div>
              </div>
            </div>
          </div>

          {/* Next Step Preview */}
          {nextStep ? (
            <div style={{ 
              width: 335, backgroundColor: '#FFF', border: '1.5px solid #130537', borderRadius: 12, 
              padding: '13.5px 17.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>다음</span>
                </div>
                <div style={{ 
                  fontSize: 16, fontWeight: 500, color: 'rgba(0,12,30,0.8)', 
                  lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                }}>
                  {nextStep.text}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, marginLeft: 16 }}>
                <div style={{ width: 1, height: 26, backgroundColor: 'rgba(0,25,54,0.1)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(3,24,50,0.46)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5, fontFamily: 'Lexend, sans-serif' }}>
                    {nextStep.timeEstimate.replace('분', ' min')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: 44 }} /> /* Placeholder for alignment */
          )}
        </div>

        {/* Check Particles Container */}
        <div style={{ position: 'absolute', bottom: 90, left: 0, right: 0, pointerEvents: 'none', zIndex: 20, height: 0 }}>
          {checkParticles.map(p => (
            <img 
              key={p.id} 
              src="/assets/icon-check.svg" 
              className="check-particle"
              style={{
                left: p.left,
                bottom: 0,
                animationDelay: p.delay,
                '--start-rot': p.startRot,
                '--end-x': p.endX,
                '--end-rot': p.endRot,
              } as React.CSSProperties}
              alt=""
            />
          ))}
        </div>

        {/* Bottom CTAs */}
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, padding: '0 20px', display: 'flex', gap: 8, boxSizing: 'border-box', zIndex: 10 }}>
          <button 
            onClick={() => setIsStopPopupOpen(true)}
            style={{ 
              flex: 1, backgroundColor: '#FFF', border: '1.5px solid rgba(2,9,19,0.91)', borderRadius: 12,
              padding: '13.5px 9.5px', fontSize: 18, fontWeight: 600, color: 'rgba(0,12,30,0.8)', cursor: 'pointer', lineHeight: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            여기서 멈출게요
          </button>
          <button 
            onClick={handleNext}
            style={{ 
              flex: 1, backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12,
              padding: '13.5px 9.5px', fontSize: 18, fontWeight: 600, color: '#130537', cursor: 'pointer', lineHeight: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}
          >
            <span>완료했어요</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Action Completion Popup */}
        {showActionPopup && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(1.5px)', zIndex: 4000 }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#FFF', width: 311, maxHeight: 640, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 4001, overflow: 'hidden' }}>
              
              <div style={{ width: '100%', padding: '22px 22px 0 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'rgba(0,12,30,0.8)', margin: 0, lineHeight: 1.35, fontFamily: "'Pretendard', sans-serif" }}>
                    수고하셨어요!
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'rgba(3,18,40,0.7)', margin: 0, lineHeight: 1.6, fontFamily: "'Pretendard', sans-serif" }}>
                    오늘 할 일을 멋지게 완료했어요
                  </p>
                </div>
              </div>
              
              <div style={{ width: 140, height: 140, position: 'relative', overflow: 'hidden', flexShrink: 0, marginTop: 16 }}>
                <img src="/assets/img-sucess.png" alt="완료 그래픽" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              <div style={{ width: '100%', padding: '24px 16px 16px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
                <button 
                  onClick={() => {
                    setShowActionPopup(false);
                    
                    const newItem = {
                      id: Date.now(),
                      text: goal,
                      date: new Date().toLocaleDateString('en-US'),
                      when: startWhen,
                      where: startWhere,
                      steps: steps,
                      status: 'complete' as const,
                      category: goalCategory
                    };
                    setHistory(prev => [newItem, ...prev]);
                    
                    // Trigger confetti
                    const confettiDivs = Array.from({ length: 30 }).map((_, i) => {
                      const el = document.createElement('div');
                      el.className = 'confetti-piece';
                      el.style.left = `${Math.random() * 100}%`;
                      el.style.backgroundColor = ['#FFC800', '#FF0000', '#0044FF', '#00CC00', '#FF00CC'][Math.floor(Math.random() * 5)];
                      el.style.animationDelay = `${Math.random() * 0.5}s`;
                      return el;
                    });
                    const container = document.getElementById('confetti-container');
                    if (container) {
                      confettiDivs.forEach(div => container.appendChild(div));
                      setTimeout(() => {
                        confettiDivs.forEach(div => div.remove());
                      }, 2500);
                    }
                    setScreen('receipt');
                  }}
                  style={{ 
                    flex: 1, backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12, 
                    padding: '13.5px 9.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#130537', fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>
                    확인
                  </span>
                </button>
              </div>

            </div>
          </>
        )}



        {/* Stop Popup Dialog */}
        {isStopPopupOpen && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(1.5px)', zIndex: 2000 }} onClick={() => setIsStopPopupOpen(false)} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#FFF', width: 311, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2001, overflow: 'hidden' }}>
              <div style={{ width: '100%', padding: '22px 22px 0 22px', display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(0,12,30,0.8)', lineHeight: 1.35 }}>여기서 멈출까요?</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(3,18,40,0.7)', lineHeight: 1.6 }}>언제든지 다시 시작할 수 있어요!</div>
              </div>
              <div style={{ width: '100%', display: 'flex', gap: 8, padding: '24px 16px 16px', boxSizing: 'border-box' }}>
                <button 
                  onClick={() => setIsStopPopupOpen(false)}
                  style={{ flex: 1, backgroundColor: '#FFF', border: '1.5px solid rgba(2,9,19,0.91)', borderRadius: 12, padding: '13.5px 9.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0,12,30,0.8)' }}>더 할래요</span>
                </button>
                <button 
                  onClick={() => { 
                    setIsStopPopupOpen(false);
                    const newItem = {
                      id: Date.now(),
                      text: goal,
                      date: new Date().toLocaleDateString('en-US'),
                      when: startWhen,
                      where: startWhere,
                      steps: steps,
                      status: 'incomplete' as const,
                      category: goalCategory
                    };
                    setHistory(prev => [newItem, ...prev]);
                    setScreen('home'); 
                  }}
                  style={{ flex: 1, backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12, padding: '13.5px 9.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#130537' }}>네 멈출래요</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    // Compute Stats
    const totalCompletedActions = history.reduce((acc, h) => acc + (h.steps ? h.steps.filter(s => s.completed).length : 0), 0);
    const totalGoalCompletions = history.filter(h => h.status === 'complete').length;
    
    // Compute consecutive days
    let consecutiveDays = 0;
    if (history.length > 0) {
      const dates = history.map(h => {
        const parts = h.date.split('.');
        if (parts.length >= 3) {
          return new Date(h.date).getTime();
        }
        return new Date(h.date).getTime();
      }).filter(d => !isNaN(d)).sort((a, b) => b - a);
      
      const uniqueDates = Array.from(new Set(dates.map(d => new Date(d).setHours(0,0,0,0)))).sort((a,b)=>b-a);
      
      if (uniqueDates.length > 0) {
        consecutiveDays = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
          const diff = (uniqueDates[i] - uniqueDates[i+1]) / (1000 * 60 * 60 * 24);
          if (diff === 1) {
            consecutiveDays++;
          } else {
            break;
          }
        }
      }
    }
    const getDaysInMonth = () => {
      const year = currentMonthDate.getFullYear();
      const month = currentMonthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
      firstDay = firstDay === 0 ? 6 : firstDay - 1; // Convert to Monday start
      return { year, month, daysInMonth, firstDay };
    };

    const renderCalendar = () => {
      const { year, month, daysInMonth, firstDay } = getDaysInMonth();
      
      const handlePrevMonth = () => setCurrentMonthDate(new Date(year, month - 1, 1));
      const handleNextMonth = () => setCurrentMonthDate(new Date(year, month + 1, 1));
      
      const monthName = currentMonthDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      
      const blanks = Array.from({ length: firstDay }).map((_, i) => (
        <div key={`blank-${i}`} style={{ backgroundColor: '#F2F4F6', height: 44 }} />
      ));
      
      const days = Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1;
        const dateStr = new Date(year, month, day).toLocaleDateString('en-US');
        const historyItem = history.find(h => h.date === dateStr);
        const isCompleted = historyItem?.status === 'complete';
        const bgColor = isCompleted ? '#FAE588' : '#FFF';
        
        return (
          <div 
            key={`day-${day}`}
            onClick={() => setSelectedDate(dateStr)}
            style={{
              backgroundColor: bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
              cursor: 'pointer',
              color: 'rgba(3,18,40,0.7)',
              fontFamily: "'Lexend', sans-serif",
              fontSize: 16
            }}
          >
            {day}
          </div>
        );
      });
      
      const totalCells = firstDay + daysInMonth;
      const trailingBlanksCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      const trailingBlanks = Array.from({ length: trailingBlanksCount }).map((_, i) => (
        <div key={`t-blank-${i}`} style={{ backgroundColor: '#F2F4F6', height: 44 }} />
      ));

      const selectedRecords = selectedDate ? history.filter(h => h.date === selectedDate) : [];

      return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <img src="/assets/icon-arrow-back.svg" alt="prev" style={{ width: 18, height: 18 }} />
            </button>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Lexend', sans-serif", color: 'rgba(0,12,30,0.8)', minWidth: 120, textAlign: 'center' }}>
              {monthName}
            </div>
            <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transform: 'rotate(180deg)' }}>
              <img src="/assets/icon-arrow-back.svg" alt="next" style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Calendar Grid */}
          <div style={{ 
            width: '100%', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            backgroundColor: '#333d4b', 
            gap: '1.5px', 
            border: '1.5px solid #333d4b', 
            borderRadius: 8, 
            overflow: 'hidden'
          }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
              <div key={d} style={{ backgroundColor: '#FFF', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Lexend', sans-serif", fontSize: 16, color: 'rgba(3,18,40,0.7)' }}>
                {d}
              </div>
            ))}
            {blanks}
            {days}
            {trailingBlanks}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', width: '100%', gap: 16, marginTop: 18, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 16, backgroundColor: '#FAE588', borderRadius: 4 }} />
              <span style={{ fontSize: 14, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(3,18,40,0.7)' }}>완료</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 16, backgroundColor: '#D1D6DB', borderRadius: 4 }} />
              <span style={{ fontSize: 14, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(3,18,40,0.7)' }}>미완료</span>
            </div>
          </div>

          {/* Selected Date Card */}
          {selectedDate && (
            <div style={{ width: '100%', marginTop: 30 }}>
              {selectedRecords.length === 0 ? (
                // State - No
                <div style={{ 
                  backgroundColor: '#FFF', 
                  border: '1.5px solid #130537', 
                  borderRadius: 12, 
                  padding: '17.5px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 4,
                  marginBottom: 12
                }}>
                  <div style={{ fontSize: 14, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(3,18,40,0.7)' }}>
                    {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 16, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(0,12,30,0.8)' }}>
                    이 날은 기록이 없어요
                  </div>
                </div>
              ) : (
                selectedRecords.map((item, idx) => {
                  const imgUrl = getGoalImage(item.category || 'default');
                  const isIncomplete = item.status === 'incomplete';
                  
                  return (
                    <div key={item.id} style={{ 
                      backgroundColor: '#FFF', 
                      border: '1.5px solid #130537', 
                      borderRadius: 12, 
                      padding: '17.5px', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(3,18,40,0.7)' }}>
                            {new Date(item.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          </span>
                          <div style={{ backgroundColor: isIncomplete ? '#D1D6DB' : '#FAE588', borderRadius: 50, padding: '2px 8px', fontSize: 14, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(3,18,40,0.7)' }}>
                            {isIncomplete ? '미완료' : '완료'}
                          </div>
                        </div>
                        <div style={{ fontSize: 16, fontFamily: "'Pretendard', sans-serif", fontWeight: 500, color: 'rgba(0,12,30,0.8)' }}>
                          {item.text}
                        </div>
                      </div>
                      <div style={{ width: 50, height: 50 }}>
                        <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#F2F4F6', paddingBottom: 100 }}>
        
        {/* View Toggle */}
        <div style={{ display: 'flex', width: '100%', gap: 8, padding: 20, boxSizing: 'border-box' }}>
          <div 
            onClick={() => setHistoryView('list')}
            style={{ flex: 1, backgroundColor: historyView === 'list' ? '#191f28' : '#FFF', border: historyView === 'list' ? '1.5px solid #191f28' : '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12, padding: '11.5px 21.5px', textAlign: 'center', color: historyView === 'list' ? '#FFF' : 'rgba(0,12,30,0.8)', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif" }}
          >
            보드
          </div>
          <div 
            onClick={() => setHistoryView('calendar')}
            style={{ flex: 1, backgroundColor: historyView === 'calendar' ? '#191f28' : '#FFF', border: historyView === 'calendar' ? '1.5px solid #191f28' : '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12, padding: '11.5px 21.5px', textAlign: 'center', color: historyView === 'calendar' ? '#FFF' : 'rgba(0,12,30,0.8)', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif" }}
          >
            캘린더
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: 1, borderTop: '1.5px solid rgba(0,12,30,0.8)', borderLeft: '1.5px solid rgba(0,12,30,0.8)', borderBottom: '1.5px solid rgba(0,12,30,0.8)', borderRadius: '12px 0 0 12px', padding: 16, backgroundColor: '#FFF', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 14, color: 'rgba(3,18,40,0.7)', fontWeight: 500, fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>시작 행동</div>
            <div style={{ fontSize: 26, color: 'rgba(0,12,30,0.8)', fontWeight: 600, fontFamily: "'Lexend', sans-serif", letterSpacing: -0.26, lineHeight: 1.2 }}>{totalCompletedActions}</div>
          </div>
          <div style={{ flex: 1, border: '1.5px solid rgba(0,12,30,0.8)', borderBottom: '1.5px solid rgba(0,12,30,0.8)', padding: 16, backgroundColor: '#FFF', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 14, color: 'rgba(3,18,40,0.7)', fontWeight: 500, fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>할 일 완료</div>
            <div style={{ fontSize: 26, color: 'rgba(0,12,30,0.8)', fontWeight: 600, fontFamily: "'Lexend', sans-serif", letterSpacing: -0.26, lineHeight: 1.2 }}>{totalGoalCompletions}</div>
          </div>
          <div style={{ flex: 1, borderTop: '1.5px solid rgba(0,12,30,0.8)', borderRight: '1.5px solid rgba(0,12,30,0.8)', borderBottom: '1.5px solid rgba(0,12,30,0.8)', borderRadius: '0 12px 12px 0', padding: 16, backgroundColor: '#FFF', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 14, color: 'rgba(3,18,40,0.7)', fontWeight: 500, fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>연속 일수</div>
            <div style={{ fontSize: 26, color: 'rgba(0,12,30,0.8)', fontWeight: 600, fontFamily: "'Lexend', sans-serif", letterSpacing: -0.26, lineHeight: 1.2 }}>{consecutiveDays}</div>
          </div>
        </div>
        
        {historyView === 'calendar' ? (
          <div style={{ padding: '30px 20px', width: '100%', boxSizing: 'border-box' }}>
            {renderCalendar()}
          </div>
        ) : (
          history.length === 0 ? (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '130px 20px', flexShrink: 0, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ transform: 'scaleX(-1)' }}>
                    <div style={{ position: 'relative', width: 90, height: 90 }}>
                      <img src="/assets/img-default.png" alt="빈 기록" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                </div>
                <div style={{ color: 'rgba(3,24,50,0.46)', textAlign: 'center', fontSize: 16, fontWeight: 600, fontFamily: "'Pretendard', sans-serif", wordBreak: 'break-word', whiteSpace: 'nowrap', lineHeight: '28px' }}>
                  아직 완료한 기록이 없어요!
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', padding: '30px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, boxSizing: 'border-box' }}>
              {history.map((item, idx) => {
                const colors = ['#FAE588', '#BFBDFF', '#C5E3FF', '#F8DDE1'];
                const bgColor = colors[idx % colors.length];
                
                // Date parsing
                const dateObj = new Date(item.date);
                const day = isNaN(dateObj.getTime()) ? item.date.slice(item.date.lastIndexOf(' ') + 1, item.date.lastIndexOf('.')) || item.date : dateObj.getDate();
                const monthStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                
                // Calculate minutes
                let totalMinutes = 0;
                const totalSteps = item.steps?.length || 0;
                item.steps?.forEach(st => {
                  const m = parseInt(st.timeEstimate.replace(/[^0-9]/g, ''));
                  if(!isNaN(m)) totalMinutes += m;
                });

                // Image mapping
                const imgUrl = getGoalImage(item.category || 'default');

                return (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedHistoryItem(item)}
                    style={{ 
                      backgroundColor: bgColor, height: 200, position: 'relative', overflow: 'hidden', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column'
                    }}
                  >
                    {/* Image at Top Right */}
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={imgUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>

                    <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {/* Date */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 30, fontFamily: "'Lexend', sans-serif", fontWeight: 300, lineHeight: 1.2, color: 'rgba(0,12,30,0.8)' }}>{day}</span>
                        <span style={{ fontSize: 10, fontFamily: "'Lexend', sans-serif", fontWeight: 400, lineHeight: 1.2, letterSpacing: -0.2, color: 'rgba(0,12,30,0.8)' }}>{monthStr || 'MON'}</span>
                      </div>
                      
                      {/* Goal Title */}
                      <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600, fontFamily: "'Pretendard', sans-serif", color: 'rgba(0,12,30,0.8)', letterSpacing: -0.3, lineHeight: 1.4, wordBreak: 'keep-all', width: '70%' }}>
                        {item.text}
                      </div>
                    </div>

                    {/* Footer text */}
                    <div style={{ padding: '0 16px 16px 16px', fontSize: 11, fontWeight: 500, fontFamily: "'Pretendard', sans-serif", color: 'rgba(0,19,43,0.58)', letterSpacing: -0.22 }}>
                      {totalSteps}가지의 행동 총 {totalMinutes}분
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    );
  };

  const renderReceipt = (historyItem?: {id: number, text: string, date: string, steps?: Step[], when?: string, where?: string, category?: string}) => {
    const isHistoryView = !!historyItem;
    const displayGoal = isHistoryView ? historyItem.text : goal;
    const displaySteps = isHistoryView ? (historyItem.steps || []) : steps;
    const displayCategory = isHistoryView ? (historyItem.category || 'default') : goalCategory;

    // Date parsing
    let dateObj = new Date();
    if (isHistoryView && historyItem.date) {
      const cleaned = historyItem.date.replace(/년|월/g, '/').replace(/일/g, '').replace(/\s/g, '').replace(/\.$/, '').replace(/\./g, '/');
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    const day = dateObj.getDate();
    const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    
    const bgColor = isHistoryView ? '#fae588' : (postItColor || '#fae588');

    const handleClose = () => {
      if (isHistoryView) {
        setSelectedHistoryItem(null);
      } else {
        setGoal('');
        setSteps([]);
        setStartWhen('');
        setStartWhere('');
        setScreen('home');
      }
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
        {/* Dimming Overlay */}
        <div 
          onClick={handleClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(1.5px)' }}
        />
        
        <div style={{ position: 'relative', zIndex: 5001, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Close Button */}
          <div 
            onClick={handleClose}
            style={{ 
              width: 44, height: 44, backgroundColor: '#FFF', border: '1.9px solid rgba(3,18,40,0.7)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#191f28" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>

          {/* Card */}
          <div style={{ position: 'relative', width: 272, height: 469, backgroundColor: bgColor, borderRadius: 16, overflow: 'hidden' }}>
            {/* Date */}
            <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 50, fontWeight: 300, lineHeight: 1.1, fontFamily: "'Lexend', sans-serif", color: 'rgba(0,12,30,0.8)' }}>{day}</span>
              <span style={{ fontSize: 16, fontWeight: 400, lineHeight: 1.2, fontFamily: "'Lexend', sans-serif", color: 'rgba(0,12,30,0.8)', letterSpacing: -0.32 }}>{month}</span>
            </div>

            {/* Goal */}
            <div style={{ position: 'absolute', top: 110, left: 20, width: 214 }}>
              <p style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0,12,30,0.8)', margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap', fontFamily: "'Pretendard', sans-serif" }}>
                {displayGoal}
              </p>
            </div>

            {/* Graphic Image */}
            <div style={{ position: 'absolute', top: 10, right: 10, width: 100, height: 100 }}>
              <img src={getGoalImage(displayCategory)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            {/* Steps */}
            <div style={{ position: 'absolute', top: 227, left: 27, width: 157, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {displaySteps.slice(0, 5).map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: 'rgba(0,19,43,0.58)', fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>{idx + 1}</span>
                  <span style={{ fontSize: 14, color: 'rgba(3,18,40,0.7)', fontFamily: "'Pretendard', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }}>{step.text}</span>
                </div>
              ))}
              {displaySteps.length > 5 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: 'rgba(0,19,43,0.58)', fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>...</span>
                </div>
              )}
            </div>

            {/* Duration text */}
            <div style={{ position: 'absolute', top: 434, left: 20, transform: 'translateY(-50%)' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,19,43,0.58)', margin: 0, fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>
                {displaySteps.length}가지의 행동을 완료했어요
              </p>
            </div>

            {/* Done Badge */}
            <div style={{ position: 'absolute', top: 418, right: 20, padding: '4px 16px', height: 31, backgroundColor: '#191f28', borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#FFF', fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5 }}>완료</span>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderFeedbackPopup = () => {
    return (
      <>
        {isFeedbackPopupOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(1.5px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ width: 311, backgroundColor: '#FFF', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              <div style={{ padding: '20px 20px 0 20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <div onClick={() => setIsFeedbackPopupOpen(false)} style={{ cursor: 'pointer', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="rgba(0,12,30,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                
                <div style={{ marginTop: 14, width: '100%' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: 'rgba(0,12,30,0.8)', lineHeight: 1.5, fontFamily: "'Pretendard', sans-serif" }}>
                    서비스 의견을 적어주세요!
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'rgba(3,18,40,0.7)', lineHeight: 1.5, fontFamily: "'Pretendard', sans-serif" }}>
                    더욱 발전하는 DO IT을 만드는데 도움이 돼요
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: 6, padding: '20px 0', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const isActive = feedbackRating >= star;
                    const starColor = isActive ? '#FAE588' : '#B0B8C1';
                    return (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'transform 0.2s',
                          transform: isActive ? 'scale(1.1)' : 'scale(1)'
                        }}
                      >
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path 
                            d="M14.3117 13.7269L18.6417 5.0069C18.7678 4.75454 18.9616 4.54228 19.2016 4.39393C19.4415 4.24557 19.718 4.16699 20.0001 4.16699C20.2822 4.16699 20.5587 4.24557 20.7986 4.39393C21.0385 4.54228 21.2324 4.75454 21.3584 5.0069L25.6884 13.7269L35.3684 15.1336C35.6476 15.1723 35.9103 15.2887 36.1265 15.4696C36.3427 15.6504 36.5037 15.8885 36.5911 16.1564C36.6786 16.4244 36.6889 16.7116 36.6209 16.9852C36.5529 17.2587 36.4094 17.5077 36.2067 17.7036L29.2034 24.4869L30.8567 34.0702C31.0684 35.3002 29.7684 36.2369 28.6567 35.6569L20.0001 31.1302L11.3417 35.6569C10.2317 36.2386 8.93174 35.3002 9.1434 34.0686L10.7967 24.4852L3.7934 17.7019C3.59171 17.5059 3.44907 17.2572 3.38168 16.9841C3.31429 16.711 3.32486 16.4245 3.41219 16.1571C3.49951 15.8898 3.6601 15.6523 3.87569 15.4716C4.09127 15.291 4.35321 15.1744 4.63174 15.1352L14.3117 13.7269Z" 
                            fill={starColor} 
                            stroke={starColor} 
                            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transition: 'all 0.2s' }}
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>

                <textarea 
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="느낀 점이나 개선되었으면 좋겠는 점을&#10;자유롭게 적어주세요!"
                  style={{
                    width: '100%', height: 170, padding: 15.5, borderRadius: 12, border: '1.5px solid rgba(0,29,58,0.18)',
                    fontSize: 14, fontWeight: 500, fontFamily: "'Pretendard', sans-serif", backgroundColor: '#F2F4F6', color: '#191f28', resize: 'none',
                    outline: 'none', boxSizing: 'border-box', lineHeight: 1.5
                  }}
                />
              </div>

              <div style={{ padding: '16px 20px 24px 20px', width: '100%', boxSizing: 'border-box', display: 'flex' }}>
                <button 
                  disabled={feedbackRating === 0}
                  onClick={() => {
                    setIsFeedbackPopupOpen(false);
                    setFeedbackText('');
                    setFeedbackRating(0);
                    showToast('소중한 의견이 제출되었습니다!');
                  }}
                  style={{ 
                    flex: 1, padding: '13.5px 0', borderRadius: 12, 
                    backgroundColor: feedbackRating === 0 ? '#e5e8eb' : '#c5e3ff', 
                    color: feedbackRating === 0 ? 'rgba(3,24,50,0.46)' : '#130537', 
                    fontSize: 18, fontWeight: 600, 
                    border: feedbackRating === 0 ? '1.5px solid #8b95a1' : '1.5px solid rgba(0,12,30,0.8)', 
                    cursor: feedbackRating === 0 ? 'not-allowed' : 'pointer', 
                    fontFamily: "'Pretendard', sans-serif", lineHeight: 1.5,
                    transition: 'all 0.2s'
                  }}
                >
                  의견 보내기
                </button>
              </div>
            </div>
          </div>
        )}

        {isHomeCalendarSheetOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', justifyContent: 'center' }}>
            <div 
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(1.5px)' }} 
              onClick={() => setIsHomeCalendarSheetOpen(false)}
            />
            <div style={{ 
              position: 'absolute', bottom: 20, width: '100%', maxWidth: 355, 
              backgroundColor: '#FFF', borderRadius: 28, 
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingBottom: 30, overflow: 'hidden'
            }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
                <div style={{ width: 48, height: 4, backgroundColor: '#e5e8eb', borderRadius: 40 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <button 
                  onClick={() => setHomeCalendarSheetDate(new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth() - 1, 1))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <img src="/assets/icon-arrow-back.svg" alt="prev" style={{ width: 18, height: 18 }} />
                </button>
                <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "'Lexend', sans-serif", color: 'rgba(3,18,40,0.7)', minWidth: 100, textAlign: 'center' }}>
                  {`${homeCalendarSheetDate.getFullYear()}.${String(homeCalendarSheetDate.getMonth() + 1).padStart(2, '0')}`}
                </div>
                <button 
                  onClick={() => setHomeCalendarSheetDate(new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth() + 1, 1))} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transform: 'rotate(180deg)' }}
                >
                  <img src="/assets/icon-arrow-back.svg" alt="next" style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div style={{ width: '100%', padding: '0 20px' }}>
                <div style={{ 
                  width: '100%', 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(7, 1fr)', 
                  backgroundColor: '#333d4b', 
                  gap: '1.5px', 
                  border: '1.5px solid #333d4b', 
                  borderRadius: 8, 
                  overflow: 'hidden'
                }}>
                  {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                    <div key={d} style={{ backgroundColor: '#FFF', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Lexend', sans-serif", fontSize: 16, color: 'rgba(3,24,50,0.46)' }}>
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: (() => {
                    let fd = new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth(), 1).getDay();
                    return fd === 0 ? 6 : fd - 1;
                  })() }).map((_, i) => (
                    <div key={`blank-${i}`} style={{ backgroundColor: '#F2F4F6', height: 44 }} />
                  ))}
                  {Array.from({ length: new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                    const day = i + 1;
                    const cellDate = new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth(), day);
                    const isSelected = homeDate.toLocaleDateString() === cellDate.toLocaleDateString();
                    
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const isFuture = cellDate > today;
                    const isToday = cellDate.getTime() === today.getTime();

                    return (
                      <div 
                        key={`day-${day}`}
                        onClick={() => {
                          if (isFuture) return;
                          setHomeDate(cellDate);
                          setIsHomeCalendarSheetOpen(false);
                        }}
                        style={{
                          backgroundColor: '#FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 44,
                          cursor: isFuture ? 'not-allowed' : 'pointer',
                          position: 'relative'
                        }}
                      >
                        {isSelected && (
                          <div style={{ position: 'absolute', width: 34, height: 34, backgroundColor: '#191f28', borderRadius: '50%' }} />
                        )}
                        <span style={{ 
                          position: 'relative', zIndex: 1, 
                          color: isFuture ? 'rgba(3,24,50,0.2)' : (isSelected ? '#FFF' : 'rgba(3,18,40,0.7)'),
                          fontFamily: "'Lexend', sans-serif",
                          fontSize: 16
                        }}>
                          {day}
                        </span>
                        {isToday && (
                          <div style={{ position: 'absolute', bottom: 36, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ padding: '3px 8px', backgroundColor: '#FFF', border: '1.5px solid #333d4b', borderRadius: 14, fontSize: 11, fontWeight: 700, color: '#333d4b', fontFamily: "'Pretendard', sans-serif", lineHeight: 1, position: 'relative', zIndex: 1 }}>
                              오늘
                            </div>
                            <div style={{ position: 'absolute', bottom: -3.5, width: 7, height: 7, backgroundColor: '#FFF', borderBottom: '1.5px solid #333d4b', borderRight: '1.5px solid #333d4b', transform: 'rotate(45deg)', zIndex: 2, borderRadius: 1 }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {Array.from({ length: (() => {
                    const daysInMonth = new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth() + 1, 0).getDate();
                    let fd = new Date(homeCalendarSheetDate.getFullYear(), homeCalendarSheetDate.getMonth(), 1).getDay();
                    fd = fd === 0 ? 6 : fd - 1;
                    const total = fd + daysInMonth;
                    return total % 7 === 0 ? 0 : 7 - (total % 7);
                  })() }).map((_, i) => (
                    <div key={`t-blank-${i}`} style={{ backgroundColor: '#F2F4F6', height: 44 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div style={{ fontFamily: 'inherit', position: 'relative' }}>
      {/* Screens Render Logic */}
      {tab === 'home' && screen === 'onboarding' && renderOnboarding()}
      {tab === 'home' && screen === 'home' && renderHome()}
      {tab === 'home' && screen === 'breakdown' && renderBreakdown()}
      {tab === 'home' && screen === 'editSteps' && renderEditSteps()}
      {tab === 'home' && screen === 'action' && renderAction()}
      {tab === 'home' && screen === 'receipt' && renderReceipt()}
      
      {/* Detail Overlay */}
      {selectedHistoryItem && renderReceipt(selectedHistoryItem)}

      {/* Bottom Sheet Overlay */}
      {isBottomSheetOpen && renderBottomSheet()}

      {/* Add Step Bottom Sheet Overlay */}
      {isAddStepSheetOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setIsAddStepSheetOpen(false)}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)', zIndex: 2000,
            }}
          />
          {/* Sheet */}
          <div 
            style={{
              position: 'fixed', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 355,
              backgroundColor: '#FFF', borderRadius: 28,
              paddingBottom: 30, zIndex: 2002,
              animation: 'slideUpCentered 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
              <div style={{ width: 48, height: 4, backgroundColor: '#E5E8EB', borderRadius: 40 }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                {/* Input Container */}
                <div style={{ flex: 1, border: '1.5px solid #b0b8c1', borderRadius: 12, padding: '13.5px 17.5px', display: 'flex', alignItems: 'center' }}>
                  <input 
                    autoFocus
                    type="text"
                    value={newStepText}
                    onChange={(e) => setNewStepText(e.target.value)}
                    placeholder="새 단계 입력"
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Pretendard', fontSize: 16, color: 'rgba(0,12,30,0.8)' }}
                  />
                </div>
                
                {/* Time Picker Container */}
                <div 
                  onClick={() => {
                    setTimePickerTarget('new');
                    setIsTimePickerOpen(true);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 2px', borderRadius: 12, cursor: 'pointer' }}
                >
                  <img src="/assets/icon-clock.svg" alt="clock" style={{ width: 20, height: 20, opacity: 0.5 }} />
                  <span style={{ fontFamily: 'Lexend', fontSize: 16, color: 'rgba(3,24,50,0.46)', marginTop: 2 }}>
                    {newStepTime || '5 min'}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 20px 0', width: '100%', boxSizing: 'border-box' }}>
              <button 
                onClick={() => {
                  if (!newStepText.trim()) return;
                  const newStep: Step = {
                    id: Date.now().toString(),
                    text: newStepText,
                    completed: false,
                    timeEstimate: newStepTime || '5 min'
                  };
                  setSteps([...steps, newStep]);
                  setNewStepText('');
                  setIsAddStepSheetOpen(false);
                }}
                style={{ 
                  width: '100%',
                  backgroundColor: newStepText.trim() ? '#c5e3ff' : '#E5E8EB',
                  border: newStepText.trim() ? '1.5px solid rgba(0,12,30,0.8)' : '1.5px solid #8b95a1',
                  color: newStepText.trim() ? '#130537' : 'rgba(3,24,50,0.46)',
                  padding: '13.5px 9.5px', borderRadius: 12, fontFamily: 'Pretendard', fontSize: 18, fontWeight: 600,
                  cursor: newStepText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                완료
              </button>
            </div>
          </div>
        </>
      )}
      
      {tab === 'history' && renderHistory()}

      {renderFeedbackPopup()}

      {/* Toast Message */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,12,30,0.8)', color: '#FFF', padding: '12px 24px',
          borderRadius: 30, fontSize: 14, fontWeight: 500, fontFamily: "'Pretendard', sans-serif",
          zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
          animation: 'fadeInOut 3s ease-in-out forwards'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Time Picker Bottom Sheet */}
      {isTimePickerOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 3000 }} 
            onClick={() => setIsTimePickerOpen(false)}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 375, backgroundColor: '#FFF',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '16px 0 32px', boxSizing: 'border-box', zIndex: 3001,
            animation: 'slideUpCentered 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{ width: 40, height: 4, backgroundColor: '#E5E8EB', borderRadius: 4, marginBottom: 24 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: '#191f28', marginBottom: 20, width: '100%', padding: '0 20px', boxSizing: 'border-box' }}>시간 선택</div>
            
            <div style={{ position: 'relative', width: '100%', height: 150, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 110, height: 46, backgroundColor: '#F2F4F6', borderRadius: 12, pointerEvents: 'none', zIndex: 1 }} />
              
              <div 
                className="hide-scrollbar"
                style={{ 
                  height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', 
                  position: 'relative', zIndex: 2, padding: '52px 0', boxSizing: 'border-box'
                }}
                onScroll={(e) => {
                  const index = Math.round(e.currentTarget.scrollTop / 46);
                  const times = [
                    '1 min', '5 min', '10 min', '15 min', '20 min', '25 min', '30 min', '35 min', '40 min', '45 min', '50 min', '55 min', '60 min',
                    '70 min', '80 min', '90 min', '100 min', '110 min', '120 min',
                    '150 min', '180 min', '210 min', '240 min', '270 min', '300 min', '330 min', '360 min'
                  ];
                  if (times[index]) {
                    setPickerScrollValue(times[index]);
                  }
                }}
              >
                {[
                  '1 min', '5 min', '10 min', '15 min', '20 min', '25 min', '30 min', '35 min', '40 min', '45 min', '50 min', '55 min', '60 min',
                  '70 min', '80 min', '90 min', '100 min', '110 min', '120 min',
                  '150 min', '180 min', '210 min', '240 min', '270 min', '300 min', '330 min', '360 min'
                ].map((time) => (
                  <div key={time} style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center', fontSize: 20, fontWeight: 600, color: time === pickerScrollValue ? '#191f28' : '#B0B8C1', fontFamily: 'Lexend', transition: 'color 0.2s' }}>
                    {time.replace(' min', '')}
                    <span style={{ fontSize: 14, marginLeft: 4, fontWeight: 500, opacity: time === pickerScrollValue ? 1 : 0.6 }}>MIN</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: '100%', padding: '24px 20px 0', boxSizing: 'border-box' }}>
              <button
                onClick={() => {
                  if (timePickerTarget === 'new') {
                    setNewStepTime(pickerScrollValue);
                  } else if (typeof timePickerTarget === 'number') {
                    const newSteps = [...steps];
                    newSteps[timePickerTarget].timeEstimate = pickerScrollValue;
                    setSteps(newSteps);
                  }
                  setIsTimePickerOpen(false);
                }}
                style={{
                  width: '100%',
                  backgroundColor: '#c5e3ff',
                  border: '1.5px solid rgba(0,12,30,0.8)',
                  color: '#130537',
                  padding: '13.5px 9.5px', 
                  borderRadius: 12, 
                  fontFamily: 'Pretendard', 
                  fontSize: 18, 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}
              >
                완료
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation & Floating Button Container */}
      {screen !== 'onboarding' && screen !== 'breakdown' && screen !== 'receipt' && screen !== 'action' && screen !== 'editSteps' && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 375, height: 51, pointerEvents: 'none', zIndex: 1000
        }}>
          {/* Bottom Navigation Tab Bar */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            background: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 156,
            display: 'flex', alignItems: 'center', padding: '6px', pointerEvents: 'auto',
            width: 156, height: 51, boxSizing: 'border-box', boxShadow: '0px 6px 20px rgba(0,29,58,0.09)'
          }}>
            <div 
              onClick={() => { setTab('home'); setScreen('home'); }}
              style={{ 
                flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 36,
                background: tab === 'home' ? 'rgba(7,25,76,0.05)' : 'transparent', borderRadius: 114, cursor: 'pointer',
                justifyContent: 'center', transition: 'all 0.2s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.417 3.73986L3.61144 9.18431V16.8056H8.47255V12.9167H12.3614V16.8056H17.2225V9.65194C17.2226 9.50614 17.1899 9.3622 17.1268 9.23076C17.0636 9.09932 16.9718 8.98377 16.858 8.89264L10.417 3.73986ZM10.417 1.25L18.0723 7.375C18.4136 7.64808 18.6893 7.9944 18.8788 8.38835C19.0682 8.78231 19.1667 9.21382 19.167 9.65097V16.8056C19.167 17.3213 18.9621 17.8158 18.5975 18.1805C18.2328 18.5451 17.7382 18.75 17.2225 18.75H3.61144C3.09574 18.75 2.60116 18.5451 2.23651 18.1805C1.87185 17.8158 1.66699 17.3213 1.66699 16.8056V9.18431C1.66703 8.89287 1.73258 8.60516 1.85879 8.34247C1.985 8.07978 2.16865 7.84882 2.39616 7.66667L10.417 1.25Z" fill={tab === 'home' ? 'rgba(0,12,30,0.8)' : '#B0B8C1'}/>
              </svg>
              {tab === 'home' && <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,12,30,0.8)' }}>홈</div>}
            </div>
            <div 
              onClick={() => setTab('history')}
              style={{ 
                flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 36,
                background: tab === 'history' ? 'rgba(7,25,76,0.05)' : 'transparent', borderRadius: 114, cursor: 'pointer',
                justifyContent: 'center', transition: 'all 0.2s'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.8125 3.4375H2.1875V7.8125H17.8125V3.4375Z" stroke={tab === 'history' ? 'rgba(0,12,30,0.8)' : '#B0B8C1'} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.4375 11.5625H11.5625M3.4375 8.4375V17.8125H16.5625V8.4375" stroke={tab === 'history' ? 'rgba(0,12,30,0.8)' : '#B0B8C1'} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {tab === 'history' && <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,12,30,0.8)' }}>기록</div>}
            </div>
          </div>

          {/* Feedback Floating Button */}
          <div className="feedback-btn-container" style={{ position: 'absolute', right: 20, pointerEvents: 'auto' }}>
            <button 
              onClick={() => setIsFeedbackPopupOpen(true)}
              style={{ 
                width: 51, height: 51, backgroundColor: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, boxShadow: '0px 6px 20px rgba(0,29,58,0.09)'
              }}
            >
              <img src="/assets/icon-feedback.svg" alt="피드백" style={{ width: 22, height: 22 }} />
            </button>
            <div className="feedback-tooltip">
              서비스 피드백하기
            </div>
          </div>
        </div>
      )}
      
      {/* Global Confetti container */}
      <div 
        id="confetti-container" 
        style={{ 
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh',
          pointerEvents: 'none', zIndex: 6000, overflow: 'hidden' 
        }} 
      />
    </div>
  );
}
