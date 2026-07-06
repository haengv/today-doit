import React, { useState, useEffect, useRef } from 'react';

type TabState = 'home' | 'history';
type ScreenState = 'onboarding' | 'home' | 'breakdown' | 'action' | 'receipt';

type Step = {
  id: string;
  text: string;
  completed: boolean;
  timeEstimate: string;
};

const simulateBreakdown = async (goal: string): Promise<Step[]> => {
  return [
    { id: '1', text: '노트북 전원 켜기', completed: false, timeEstimate: '30초' },
    { id: '2', text: '폴더 열기', completed: false, timeEstimate: '1분' },
    { id: '3', text: '수정할 화면 정하기', completed: false, timeEstimate: '1분' },
    { id: '4', text: '첫번째 요소 수정하기', completed: false, timeEstimate: '1분' },
    { id: '5', text: '나머지 요소 수정하기', completed: false, timeEstimate: '1분' },
  ];
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
  const [history, setHistory] = useState<{id: number, text: string, date: string, steps?: Step[], when?: string, where?: string}[]>(() => {
    const saved = localStorage.getItem('doit_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<{id: number, text: string, date: string, steps?: Step[], when?: string, where?: string} | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isAddStepSheetOpen, setIsAddStepSheetOpen] = useState(false);
  const [newStepText, setNewStepText] = useState('');
  const [newStepTime, setNewStepTime] = useState('1분');
  const [postItColor, setPostItColor] = useState(() => localStorage.getItem('doit_postItColor') || '#FAE588');
  const [startWhen, setStartWhen] = useState(() => localStorage.getItem('doit_startWhen') || '');
  const [startWhere, setStartWhere] = useState(() => localStorage.getItem('doit_startWhere') || '');

  useEffect(() => {
    localStorage.setItem('doit_goal', goal);
    localStorage.setItem('doit_steps', JSON.stringify(steps));
    localStorage.setItem('doit_history', JSON.stringify(history));
    localStorage.setItem('doit_postItColor', postItColor);
    localStorage.setItem('doit_startWhen', startWhen);
    localStorage.setItem('doit_startWhere', startWhere);
  }, [goal, steps, history, postItColor, startWhen, startWhere]);
  
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
          
          <div style={{ position: 'absolute', bottom: -20, right: -25, transform: 'rotate(-15deg)' }}>
            <svg width="70" height="70" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.15))' }}>
              <g transform="translate(30,30) rotate(-40) translate(-30,-30)">
                <rect x="22" y="8" width="16" height="10" rx="4" fill="#FCA5A5" stroke="#191f28" strokeWidth="2.5" />
                <rect x="22" y="16" width="16" height="6" fill="#E5E8EB" stroke="#191f28" strokeWidth="2.5" />
                <rect x="22" y="22" width="16" height="20" fill="#3B82F6" stroke="#191f28" strokeWidth="2.5" />
                <line x1="27" y1="22" x2="27" y2="42" stroke="#191f28" strokeWidth="2" opacity="0.3" />
                <line x1="33" y1="22" x2="33" y2="42" stroke="#191f28" strokeWidth="2" opacity="0.3" />
                <path d="M22 42 L30 54 L38 42 Z" fill="#FDE047" stroke="#191f28" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M27.5 50.5 L30 54 L32.5 50.5 Z" fill="#191f28" />
              </g>
            </svg>
          </div>
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

  const renderHome = () => {
    const today = homeDate;
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateString = `${y}/${m}/${d}`;

    const completedCount = steps.filter(s => s.completed).length;
    const totalCount = steps.length;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const hasActiveGoal = goal.trim() !== '' && steps.length > 0;
    const allCompleted = hasActiveGoal && completedCount === totalCount;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>
        {/* Date Header Wrapper */}
        <div style={{ width: '100%', maxWidth: 375, padding: '20px 20px 0 20px', display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
            <h1 style={{ fontSize: 16, fontWeight: 400, color: '#191f28', margin: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Lexend', sans-serif" }}>
              {dateString} <img src="/assets/icon-bottom.svg" alt="" style={{ width: 14, height: 14, marginLeft: 2 }} />
            </h1>
            <input 
              type="date" 
              value={`${y}-${m}-${d}`}
              onChange={(e) => {
                if (e.target.value) {
                  setHomeDate(new Date(e.target.value));
                }
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer'
              }}
            />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,12,30,0.8)', margin: 0, wordBreak: 'keep-all', lineHeight: 1.5 }}>
                시작이 반이다.
              </p>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5 }}>아리스토텔레스</span>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2, boxSizing: 'border-box' }}>
              <img src="/assets/img-character.png" alt="캐릭터" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
        </div>
        
        <div style={{ width: '100%', maxWidth: 375, display: 'flex', flexDirection: 'column', alignItems: 'center', position: isBottomSheetOpen ? 'relative' : 'static', zIndex: isBottomSheetOpen ? 2001 : 'auto' }}>
          {/* Post-it UI Goal Card */}
          <div style={{ 
            position: 'relative', paddingTop: 36, width: '100%', display: 'flex', justifyContent: 'center',
            transform: isBottomSheetOpen ? 'translateY(-140px)' : 'translateY(0)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div 
              style={{ 
                position: 'relative', width: 220, height: 260, backgroundColor: (hasActiveGoal || isBottomSheetOpen) ? postItColor : '#FAE588', 
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
                  {today.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                </span>
              </div>

              {/* Top Right Illustration */}
              <div style={{ position: 'absolute', top: 10, right: 10, width: 70, height: 70 }}>
                <img src="/assets/img-default.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              {!hasActiveGoal && !goal.trim() ? (
                <div style={{ position: 'absolute', top: 110.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: 'rgba(3,24,50,0.46)' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>오늘 꼭 해야 할</span>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>한가지 일을 적어주세요</span>
                </div>
              ) : (
                <div style={{ position: 'absolute', top: 100.5, left: 16.5, width: 187, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <h1 style={{ fontSize: 20, fontWeight: 600, color: '#191f28', margin: 0, wordBreak: 'break-word', textAlign: 'left', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {goal}
                  </h1>
                </div>
              )}
              
              {isBottomSheetOpen && (
                <div style={{ position: 'absolute', bottom: 12, right: 16, color: 'rgba(3,24,50,0.46)', fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>
                  최대 30글자
                </div>
              )}
            </div>
          </div>

          {/* Plus FAB Button */}
          {!hasActiveGoal && (
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
              {/* Progress Box */}
              <div className="neo-card" style={{ padding: 20, backgroundColor: '#FFFFFF', border: '3px solid #191f28', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#4E5968' }}>진행도</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#3B82F6' }}>{completedCount} / {totalCount} 완료</span>
                </div>
                
                {/* Running Character Animation */}
                <div style={{ width: '100%', position: 'relative', height: 32, marginBottom: 4 }}>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: `calc(${progress}% - 12px)`, 
                    fontSize: 24,
                    transition: 'left 0.3s ease',
                    animation: progress < 100 ? 'bob 0.5s infinite alternate' : 'none'
                  }}>
                    {progress === 100 ? '🎉' : '🏃‍♂️'}
                  </div>
                </div>
                <style>{`@keyframes bob { from { transform: translateY(0px); } to { transform: translateY(-4px); } }`}</style>

                <div style={{ width: '100%', height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden', border: '2px solid #191f28' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#3B82F6', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {steps.map((step, idx) => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: step.completed ? '#F3F4F6' : '#FEF08A', border: '3px solid #191f28', borderRadius: 8, opacity: step.completed ? 0.6 : 1 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: step.completed ? '#10B981' : '#191f28', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0, fontSize: 12 }}>
                      {step.completed ? '✓' : (idx + 1)}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#191f28', textDecoration: step.completed ? 'line-through' : 'none', wordBreak: 'keep-all' }}>
                        {step.text}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: step.completed ? '#9CA3AF' : '#4E5968' }}>
                      ⏱️ {step.timeEstimate}분
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {allCompleted ? (
                <button 
                  className="neo-btn" 
                  style={{ backgroundColor: '#10B981', color: '#FFF', width: '100%' }}
                  onClick={() => {
                    setScreen('receipt');
                  }}
                >
                  🧾 영수증 뽑기
                </button>
              ) : (
                <button 
                  className="neo-btn" 
                  style={{ backgroundColor: '#3B82F6', color: '#FFF', width: '100%' }}
                  onClick={() => {
                    setActionStartTime(new Date());
                    setScreen('action');
                  }}
                >
                  ▶ 다음 행동 이어서 시작하기
                </button>
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
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)', zIndex: 2000,
        }}
      />
      <div 
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 375,
          backgroundColor: '#FFF', borderTopLeftRadius: 34, borderTopRightRadius: 34,
          padding: '16px 20px 40px', zIndex: 2002,
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
                  const historyId = Date.now();
                  setHistory(prev => [{id: historyId, text: goal, date: new Date().toLocaleDateString(), when: '', where: ''}, ...prev]);
                  
                  setIsBottomSheetOpen(false);
                  setScreen('breakdown');
                  setIsGeneratingSteps(true);
                  setBreakdownToastMessage('할 일을 단계별로 쪼개고 있어요.');
                  setShowBreakdownToast(true);
                  
                  const newSteps = await simulateBreakdown(goal);
                  
                  // Artificial delay to show loading skeleton
                  await new Promise(resolve => setTimeout(resolve, 2500));
                  
                  setSteps(newSteps);
                  setHistory(prev => prev.map(h => h.id === historyId ? { ...h, steps: newSteps } : h));
                  setIsGeneratingSteps(false);
                  
                  setBreakdownToastMessage('오늘의 할 일을 단계별로 정리했어요 ✨');
                  setTimeout(() => setShowBreakdownToast(false), 3000);
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>오늘의 할 일</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'rgba(0,12,30,0.8)', lineHeight: 1.5 }}>{goal || "포트폴리오 수정 완료하기"}</div>
        </div>
        
        {/* Illustration */}
        <div style={{ width: 140, height: 140, marginBottom: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/assets/img-default.png" alt="노트북" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        {/* Steps Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>아래 단계별로 시작해봐요</div>
          {!isGeneratingSteps && (
            <button onClick={() => setScreen('bottomSheet')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <img src="/assets/icon-edit.svg" alt="수정" style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>직접 수정하기</span>
            </button>
          )}
        </div>

        {/* Steps List or Skeleton */}
        {isGeneratingSteps ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{ height: 44, borderRadius: 8, width: '100%' }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, idx) => {
                const isFirst = idx === 0;
                return (
                  <div 
                    key={step.id} 
                    style={{ 
                      backgroundColor: isFirst ? '#FAE588' : '#F2F4F6', 
                      border: isFirst ? '1.5px solid #130537' : 'none',
                      borderRadius: 8, padding: isFirst ? '11.5px 17.5px' : '10px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      opacity: 0,
                      animation: 'fadeInUp 0.4s ease-out forwards',
                      animationDelay: `${idx * 0.15}s`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        <span style={{ fontSize: 16, fontWeight: 500, color: isFirst ? 'rgba(0,19,43,0.58)' : 'rgba(3,24,50,0.46)', lineHeight: 1.5 }}>{idx + 1}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: isFirst ? 'rgba(0,12,30,0.8)' : 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>
                        {step.text}
                      </div>
                    </div>
                    <div style={{ 
                      padding: '4px 10px', borderRadius: 20, backgroundColor: isFirst ? '#E5E8EB' : '#F2F4F6', 
                      fontSize: 12, fontWeight: 500, color: isFirst ? 'rgba(0,19,43,0.58)' : 'rgba(3,24,50,0.46)', lineHeight: 1.5 
                    }}>
                      {step.timeEstimate}
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
                  width: 32, height: 32, borderRadius: 8, backgroundColor: '#191f28', color: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          padding: '16px 20px', backgroundColor: 'rgba(3,24,50,0.92)', color: '#FFF', borderRadius: 16,
          fontSize: 14, fontWeight: 500, lineHeight: 1.5, zIndex: 1000, animation: 'toastEnter 0.3s ease-out',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8
        }}>
          {isGeneratingSteps && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {breakdownToastMessage}
        </div>
      )}

      {/* Bottom CTA */}
      {!isGeneratingSteps && (
        <div style={{ position: 'sticky', bottom: 0, width: '100%', padding: '20px', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 20%)', zIndex: 100, boxSizing: 'border-box', marginTop: 'auto' }}>
          <button 
            onClick={handleStartAction}
            style={{ 
              background: '#c5e3ff',
              border: '1.5px solid rgba(0,12,30,0.8)',
              borderRadius: 16,
              width: '100%', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none'
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 600, color: '#130537' }}>첫 행동 시작하기</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#130537" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );

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

      setIsAnimatingNext(true);
      setTimeout(() => {
        setIsAnimatingNext(false);
        // Mark current as completed
        const newSteps = [...steps];
        if (newSteps[currentActionStepIndex]) {
          newSteps[currentActionStepIndex].completed = true;
        }
        setSteps(newSteps);

        if (currentActionStepIndex < steps.length - 1) {
          // Move to next step
          setCurrentActionStepIndex(currentActionStepIndex + 1);
          setActionStartTime(new Date());
        } else {
          // Finished all steps
          setShowActionPopup(true);
        }
      }, 350);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#FFF', position: 'relative' }}>
        {/* Top Navigation */}
        <div style={{ width: '100%', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box' }}>
          <button 
            onClick={() => setScreen('breakdown')}
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
              position: 'relative', width: 315, height: 257, marginBottom: 20
            }}
          >
            {/* Background Blue Card */}
            <div style={{ 
              position: 'absolute', top: 11, left: 7, width: 315, height: 257,
              backgroundColor: '#c5e3ff', border: '1.5px solid #000', borderRadius: 14, zIndex: 1,
              animation: isAnimatingNext 
                ? 'cardMoveForward 0.35s forwards cubic-bezier(0.16, 1, 0.3, 1)' 
                : 'cardFadeInBack 0.35s backwards cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
            
            {/* Foreground White Card */}
            <div style={{ 
              position: 'absolute', top: 0, left: 0, width: 315, height: 257,
              backgroundColor: '#FFF', border: '1.5px solid #000', borderRadius: 14, zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px',
              animation: isAnimatingNext 
                ? 'cardSwipeOut 0.35s forwards cubic-bezier(0.16, 1, 0.3, 1)' 
                : 'none',
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
                      {currentStep?.timeEstimate || '1분'}면 충분해요
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
            <div style={{ width: 335, backgroundColor: '#f2f4f6', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5 }}>다음</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0,19,43,0.58)', lineHeight: 1.5 }}>{nextStep.text}</span>
              </div>
              <div style={{ backgroundColor: '#FFF', padding: '1px 6px', borderRadius: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)', lineHeight: 1.5 }}>{nextStep.timeEstimate}</span>
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
                <img src="/assets/img-character-complete.png" alt="완료 그래픽" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              <div style={{ width: '100%', padding: '24px 16px 16px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
                <button 
                  onClick={() => {
                    setShowActionPopup(false);
                    
                    const newItem = {
                      id: Date.now(),
                      text: goal,
                      date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
                      when: startWhen,
                      where: startWhere,
                      steps: steps
                    };
                    setHistory([newItem, ...history]);
                    setSelectedHistoryItem(newItem);
                    
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
                        setScreen('receipt');
                      }, 2500);
                    } else {
                      setScreen('receipt');
                    }
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

        {/* Confetti container */}
        <div 
          id="confetti-container" 
          style={{ 
            position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh',
            pointerEvents: 'none', zIndex: 5000, overflow: 'hidden' 
          }} 
        />

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
                  onClick={() => { setIsStopPopupOpen(false); setScreen('home'); }}
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
    const getDaysInMonth = () => {
      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      return { year, month, daysInMonth, firstDay };
    };

    const renderCalendar = () => {
      const { year, month, daysInMonth, firstDay } = getDaysInMonth();
      const blanks = Array.from({ length: firstDay }).map((_, i) => <div key={`blank-${i}`} />);
      const days = Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1;
        const dateStr = new Date(year, month, day).toLocaleDateString();
        const hasRecord = history.some(h => h.date === dateStr);
        const isSelected = selectedDate === dateStr;
        
        return (
          <div 
            key={`day-${day}`} 
            onClick={() => setSelectedDate(dateStr)}
            style={{
              border: '2px solid #191f28', aspectRatio: '1', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', justifyContent: 'center', background: isSelected ? '#3B82F6' : '#FFF',
              color: isSelected ? '#FFF' : '#191f28', fontWeight: 800, cursor: 'pointer', position: 'relative'
            }}
          >
            {day}
            {hasRecord && <div style={{ position: 'absolute', bottom: 4, fontSize: 16 }}>🔥</div>}
          </div>
        );
      });

      const selectedRecords = selectedDate ? history.filter(h => h.date === selectedDate) : [];

      return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, width: '100%' }}>
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontWeight: 800, color: '#4E5968' }}>{d}</div>
            ))}
            {blanks}
            {days}
          </div>

          {selectedDate && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: '#191f28', lineHeight: 1.5 }}>{selectedDate}의 기록</h3>
              {selectedRecords.length === 0 ? (
                <div style={{ color: '#4E5968', fontWeight: 700 }}>기록이 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedRecords.map(item => (
                    <div key={item.id} className="neo-card" style={{ padding: 16, border: '3px solid #191f28', backgroundColor: '#FEF08A' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#191f28', wordBreak: 'keep-all', lineHeight: 1.5 }}>{item.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>
        <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#191f28', margin: 0, lineHeight: 1.4 }}>나의 시작 기록</h1>
          <p style={{ fontSize: 16, color: '#4E5968', marginTop: 12, lineHeight: 1.5 }}>지금까지 다짐했던 목표들이에요.</p>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', width: '100%', border: '1.5px solid #4E5968', borderRadius: 24, overflow: 'hidden', marginBottom: 24 }}>
          <button 
            onClick={() => setHistoryView('list')}
            style={{ flex: 1, padding: 12, fontSize: 15, fontWeight: 800, background: historyView === 'list' ? '#4E5968' : '#FFF', color: historyView === 'list' ? '#FFF' : '#4E5968', border: 'none', borderRight: '1.5px solid #4E5968', cursor: 'pointer' }}
          >
            📋 보드
          </button>
          <button 
            onClick={() => setHistoryView('calendar')}
            style={{ flex: 1, padding: 12, fontSize: 15, fontWeight: 800, background: historyView === 'calendar' ? '#4E5968' : '#FFF', color: historyView === 'calendar' ? '#FFF' : '#4E5968', border: 'none', cursor: 'pointer' }}
          >
            📅 캘린더
          </button>
        </div>
        
        {historyView === 'calendar' ? renderCalendar() : (
          history.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: 0.5, marginTop: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗂</div>
              <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>아직 기록된 목표가 없어요!</p>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {history.map((item, idx) => {
                const colors = ['#FEF9C3', '#FBCFE8', '#BAE6FD', '#D1FAE5'];
                const bgColor = colors[idx % colors.length];
                
                return (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedHistoryItem(item)}
                    style={{ 
                      padding: '20px 16px', backgroundColor: bgColor, 
                      border: '1.5px solid #4E5968', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', 
                      aspectRatio: '1', position: 'relative'
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#4E5968', fontWeight: 800, marginBottom: 12, lineHeight: 1.5 }}>{item.date}</div>
                    <div className="handwriting" style={{ fontSize: 24, fontWeight: 800, color: '#191f28', wordBreak: 'keep-all', lineHeight: 1.3 }}>
                      {item.text}
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

  const renderReceipt = (historyItem?: {id: number, text: string, date: string, steps?: Step[], when?: string, where?: string}) => {
    const isHistoryView = !!historyItem;
    const displayGoal = isHistoryView ? historyItem.text : goal;
    const displaySteps = isHistoryView ? (historyItem.steps || []) : steps;

    // Date parsing
    const dateObj = isHistoryView && historyItem.date ? new Date(historyItem.date) : new Date();
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
              <img src="/assets/img-default.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

  return (
    <div style={{ fontFamily: 'inherit', position: 'relative' }}>
      {/* Screens Render Logic */}
      {tab === 'home' && screen === 'onboarding' && renderOnboarding()}
      {tab === 'home' && screen === 'home' && renderHome()}
      {tab === 'home' && screen === 'breakdown' && renderBreakdown()}
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
              position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)', zIndex: 2000,
            }}
          />
          {/* Sheet */}
          <div 
            style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 375,
              backgroundColor: '#FFF', borderTopLeftRadius: 34, borderTopRightRadius: 34,
              padding: '16px 20px 40px', zIndex: 2002,
              animation: 'slideUpCentered 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', flexDirection: 'column', gap: 24,
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ width: 48, height: 4, backgroundColor: '#E5E8EB', borderRadius: 40 }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
              {/* Input Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 16, fontWeight: 800, color: '#191f28' }}>추가할 할 일</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    autoFocus
                    type="text"
                    value={newStepText}
                    onChange={(e) => setNewStepText(e.target.value)}
                    placeholder="예: 영단어 10개 외우기"
                    className="neo-input"
                    style={{
                      paddingRight: 40,
                      backgroundColor: '#F3F4F6'
                    }}
                  />
                  {newStepText && (
                    <button 
                      onClick={() => setNewStepText('')}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#D1D5DB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>✕</div>
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 16, fontWeight: 800, color: '#191f28' }}>소요 시간</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['30초', '1분', '3분', '5분'].map(time => (
                    <button
                      key={time}
                      onClick={() => setNewStepTime(time)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                        border: newStepTime === time ? '1.5px solid #3B82F6' : '1.5px solid #E5E7EB',
                        backgroundColor: newStepTime === time ? '#EFF6FF' : '#FFF',
                        color: newStepTime === time ? '#1D4ED8' : '#4E5968'
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (!newStepText.trim()) return;
                const newStep: Step = {
                  id: Date.now().toString(),
                  text: newStepText,
                  completed: false,
                  timeEstimate: newStepTime
                };
                setSteps([...steps, newStep]);
                setIsAddStepSheetOpen(false);
              }}
              style={{ 
                backgroundColor: newStepText.trim() ? '#c5e3ff' : '#E5E8EB',
                border: newStepText.trim() ? '1.5px solid rgba(0,12,30,0.8)' : '1.5px solid transparent',
                color: newStepText.trim() ? '#130537' : '#9CA3AF',
                padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s', marginTop: 10
              }}
            >
              추가 완료
            </button>
          </div>
        </>
      )}
      
      {tab === 'history' && renderHistory()}

      {/* Bottom Navigation Tab Bar */}
      {screen !== 'onboarding' && screen !== 'breakdown' && screen !== 'receipt' && screen !== 'action' && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: '#FFF', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 156,
          display: 'flex', alignItems: 'center', padding: '6px', zIndex: 1000,
          width: 156
        }}>
          <div 
            onClick={() => { setTab('home'); setScreen('home'); }}
            style={{ 
              flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 36,
              background: tab === 'home' ? 'rgba(7,25,76,0.05)' : 'transparent', borderRadius: 114, cursor: 'pointer',
              justifyContent: 'center', transition: 'background 0.2s'
            }}
          >
            <img src="/assets/icon-home.svg" alt="" style={{ width: 18, height: 18 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(0,12,30,0.8)' }}>홈</div>
          </div>
          <div 
            onClick={() => setTab('history')}
            style={{ 
              flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 36,
              background: tab === 'history' ? 'rgba(7,25,76,0.05)' : 'transparent', borderRadius: 114, cursor: 'pointer',
              justifyContent: 'center', transition: 'background 0.2s'
            }}
          >
            <img src="/assets/icon-archieve.svg" alt="" style={{ width: 20, height: 20 }} />
          </div>
        </div>
      )}
    </div>
  );
}
