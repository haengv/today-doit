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
  const [screen, setScreen] = useState<ScreenState>('onboarding');
  
  const [goal, setGoal] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [isMicroBreaking, setIsMicroBreaking] = useState(false);
  const [history, setHistory] = useState<{id: number, text: string, date: string, steps?: Step[], when?: string, where?: string}[]>([]);
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
  const [postItColor, setPostItColor] = useState('#FAE588');
  const [startWhen, setStartWhen] = useState('');
  const [startWhere, setStartWhere] = useState('');
  
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: '100vh', background: '#FCE7F3' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#191f28', lineHeight: 1.4, margin: 0, wordBreak: 'keep-all' }}>
          오늘 하루,<br />단 한 가지에만<br />집중해보세요.
        </h1>
        <p style={{ fontSize: 16, color: '#4E5968', marginTop: 16 }}>
          아무리 큰 목표라도<br />첫 걸음부터 시작할 수 있게 도와드릴게요.
        </p>
      </div>
      
      <button 
        className="neo-btn" 
        style={{ backgroundColor: '#3B82F6', color: '#FFF', width: '100%', maxWidth: 320 }}
        onClick={() => setScreen('home')}
      >
        시작하기
      </button>
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
        <div style={{ width: '100%', maxWidth: 375, padding: '32px 20px 0 20px', display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
            <h1 style={{ fontSize: 16, fontWeight: 400, color: '#191f28', margin: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Lexend', sans-serif" }}>
              {dateString} 
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9L12 15L18 9" stroke="#191f28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)' }}>아리스토텔레스</span>
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
                position: 'relative', width: 240, height: 280, backgroundColor: (hasActiveGoal || isBottomSheetOpen) ? postItColor : '#FAE588', 
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
                <div style={{ position: 'absolute', top: 120.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: 'rgba(3,24,50,0.46)' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>오늘 꼭 해야 할</span>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>한가지 일을 적어주세요</span>
                </div>
              ) : (
                <div style={{ position: 'absolute', top: 110.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <h1 style={{ fontSize: 20, fontWeight: 600, color: '#191f28', margin: 0, wordBreak: 'keep-all', textAlign: 'left', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: 200 }}>
                    {goal}
                  </h1>
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 38 }}>
          <div style={{ width: 48, height: 4, backgroundColor: '#E5E8EB', borderRadius: 40 }} />
        </div>
        
        {bottomSheetStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
            {/* Post-it Color Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(3,18,40,0.7)', marginLeft: 4 }}>포스트잇 색상</div>
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
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(3,18,40,0.7)', marginLeft: 4 }}>오늘 할 일</div>
              
              <input
                placeholder="오늘 꼭 할 일 한가지를 입력하세요"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                style={{ 
                  width: '100%', border: '1.5px solid #B0B8C1', borderRadius: 12, padding: '13.5px 17.5px',
                  outline: 'none', fontSize: 16, fontWeight: 400, color: '#191f28', boxSizing: 'border-box'
                }}
              />

              {/* Suggestion Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {["포트폴리오 완성하기", "시험 공부하기", "방 청소하기", "발표 자료 만들기", "면접 준비하기"].map(chip => (
                  <div
                    key={chip}
                    onClick={() => setGoal(chip)}
                    style={{
                      backgroundColor: '#F2F4F6', borderRadius: 8, padding: '4px 12px', height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 500, color: 'rgba(0,19,43,0.58)', cursor: 'pointer'
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
                  if (!goal.trim()) return;
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
                  backgroundColor: goal.trim() ? '#c5e3ff' : '#E5E8EB',
                  border: goal.trim() ? '1.5px solid rgba(0,12,30,0.8)' : '1.5px solid #8B95A1',
                  borderRadius: 12, padding: '13.5px 0',
                  width: '100%', textAlign: 'center', fontSize: 18, fontWeight: 600,
                  color: goal.trim() ? '#130537' : 'rgba(3,24,50,0.46)',
                  cursor: goal.trim() ? 'pointer' : 'not-allowed'
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
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)' }}>오늘의 할 일</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'rgba(0,12,30,0.8)' }}>{goal || "포트폴리오 수정 완료하기"}</div>
        </div>
        
        {/* Illustration */}
        <div style={{ width: 140, height: 140, marginBottom: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/assets/img-default.png" alt="노트북" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        {/* Steps Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)' }}>아래 단계별로 시작해봐요</div>
          {!isGeneratingSteps && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <img src="/assets/icon-edit.svg" alt="수정" style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)' }}>직접 수정하기</span>
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
                        <span style={{ fontSize: 16, fontWeight: 500, color: isFirst ? 'rgba(0,19,43,0.58)' : 'rgba(3,24,50,0.46)' }}>{idx + 1}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: isFirst ? 'rgba(0,12,30,0.8)' : 'rgba(0,19,43,0.58)' }}>
                        {step.text}
                      </div>
                    </div>
                    <div style={{ 
                      backgroundColor: isFirst ? '#FFF2B7' : '#FFF', 
                      padding: '2px 6px', borderRadius: 4, 
                      fontSize: 12, fontWeight: 500, color: isFirst ? 'rgba(0,19,43,0.58)' : 'rgba(3,24,50,0.46)' 
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
          backgroundColor: 'rgba(0,0,0,0.8)', color: '#FFF', padding: '12px 20px', borderRadius: 24,
          fontSize: 14, fontWeight: 500, zIndex: 1000, animation: 'toastEnter 0.3s ease-out',
          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8
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
              width: 34, height: 34, borderRadius: 34, border: '1.5px solid rgba(3,18,40,0.7)', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#130537" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
              <path d="M15 18l-6-6 6-6"/>
            </svg>
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
            <span style={{ fontSize: 14, fontWeight: 700, color: '#6b7684' }}>{currentActionStepIndex + 1}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#b0b8c1' }}>/{steps.length}</span>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, paddingBottom: 150 }}>
          {/* Layered Card */}
          <div 
            key={currentActionStepIndex}
            style={{ 
              position: 'relative', width: 315, height: 257, marginBottom: 20,
              animation: isAnimatingNext 
                ? 'cardSwipeOut 0.35s forwards cubic-bezier(0.16, 1, 0.3, 1)' 
                : 'cardSwipeIn 0.35s backwards cubic-bezier(0.16, 1, 0.3, 1)'
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
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, marginBottom: 25, marginTop: 25 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)', letterSpacing: '-0.28px' }}>
                  지금 이것만 해볼까요?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#191f28', letterSpacing: '-0.48px', wordBreak: 'keep-all', textAlign: 'center' }}>
                    {currentStep?.text || '알 수 없는 작업'}
                  </div>
                  <div style={{ backgroundColor: '#f2f4f6', padding: '4px 6px', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)' }}>
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
                <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(3,24,50,0.46)' }}>다음</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0,19,43,0.58)' }}>{nextStep.text}</span>
              </div>
              <div style={{ backgroundColor: '#FFF', padding: '1px 6px', borderRadius: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(3,24,50,0.46)' }}>{nextStep.timeEstimate}</span>
              </div>
            </div>
          ) : (
            <div style={{ height: 44 }} /> /* Placeholder for alignment */
          )}
        </div>

        {/* Bottom CTAs */}
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, padding: '0 20px', display: 'flex', gap: 8, boxSizing: 'border-box', zIndex: 10 }}>
          <button 
            onClick={() => setIsStopPopupOpen(true)}
            style={{ 
              flex: 1, backgroundColor: '#FFF', border: '1.5px solid rgba(2,9,19,0.91)', borderRadius: 12,
              padding: '13.5px 9.5px', fontSize: 18, fontWeight: 600, color: 'rgba(0,12,30,0.8)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            여기서 멈출게요
          </button>
          <button 
            onClick={handleNext}
            style={{ 
              flex: 1, backgroundColor: '#c5e3ff', border: '1.5px solid rgba(0,12,30,0.8)', borderRadius: 12,
              padding: '13.5px 9.5px', fontSize: 18, fontWeight: 600, color: '#130537', cursor: 'pointer',
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
          <div style={{
            position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 4000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <div 
              className="anim-pop"
              style={{ width: '100%', maxWidth: 320, backgroundColor: '#FFF', borderRadius: 24, padding: '32px 24px', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>👏</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#191f28', marginBottom: 12 }}>수고하셨어요! 🎉</h2>
              <p style={{ fontSize: 16, color: '#4E5968', marginBottom: 24, lineHeight: 1.5 }}>
                모든 할 일을 완벽하게<br/>마무리하셨네요. 정말 멋져요!
              </p>
              
              <button 
                className="neo-btn" 
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
                style={{ backgroundColor: '#3B82F6', color: '#FFF', width: '100%', padding: '16px 0', fontSize: 16 }}
              >
                결과 영수증 보기
              </button>
            </div>
          </div>
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
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: '#191f28' }}>{selectedDate}의 기록</h3>
              {selectedRecords.length === 0 ? (
                <div style={{ color: '#4E5968', fontWeight: 700 }}>기록이 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedRecords.map(item => (
                    <div key={item.id} className="neo-card" style={{ padding: 16, border: '3px solid #191f28', backgroundColor: '#FEF08A' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#191f28', wordBreak: 'keep-all' }}>{item.text}</div>
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
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#191f28', margin: 0 }}>나의 시작 기록</h1>
          <p style={{ fontSize: 16, color: '#4E5968', marginTop: 12 }}>지금까지 다짐했던 목표들이에요.</p>
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
              <p style={{ fontSize: 18, fontWeight: 700 }}>아직 기록된 목표가 없어요!</p>
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
                    <div style={{ fontSize: 12, color: '#4E5968', fontWeight: 800, marginBottom: 12 }}>{item.date}</div>
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

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000', padding: '40px 20px', paddingBottom: 100, position: 'relative', zIndex: 2000 }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100vh); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ width: '100%', maxWidth: 360, background: '#F9A8D4', padding: '32px 24px', position: 'relative', overflow: 'hidden', animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, margin: 0 }}>@BEGIN_APP</h3>
            <h1 style={{ fontSize: 64, fontWeight: 900, margin: '-8px 0 8px 0', letterSpacing: -2 }}>BEGIN</h1>
            <div style={{ fontSize: 14, fontWeight: 800 }}>********** SHORT INTERVIEW **********</div>
          </div>
          
          {/* Meta Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 800, fontFamily: 'monospace', marginBottom: 24 }}>
            <div style={{ display: 'flex' }}><span style={{ width: 100 }}>Date:</span><span>{dateStr} {timeStr}</span></div>
            <div style={{ display: 'flex' }}><span style={{ width: 100 }}>Terminal:</span><span>Begin</span></div>
            <div style={{ display: 'flex' }}><span style={{ width: 100 }}>Served by:</span><span>My.Will</span></div>
          </div>
          
          <div style={{ fontSize: 14, fontWeight: 800, textAlign: 'center', marginBottom: 24 }}>
            ***************************************
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
            <span style={{ flexShrink: 0 }}>목표 :</span>
            <span style={{ wordBreak: 'keep-all' }}>{displayGoal}</span>
          </div>

          {(isHistoryView ? historyItem?.when : startWhen) && (
            <div style={{ display: 'flex', gap: 16, fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#4E5968' }}>
              <span style={{ flexShrink: 0, width: 40 }}>시간 :</span>
              <span style={{ wordBreak: 'keep-all' }}>{isHistoryView ? historyItem?.when : startWhen}</span>
            </div>
          )}
          
          {(isHistoryView ? historyItem?.where : startWhere) && (
            <div style={{ display: 'flex', gap: 16, fontSize: 14, fontWeight: 700, marginBottom: 24, color: '#4E5968' }}>
              <span style={{ flexShrink: 0, width: 40 }}>장소 :</span>
              <span style={{ wordBreak: 'keep-all' }}>{isHistoryView ? historyItem?.where : startWhere}</span>
            </div>
          )}

          {/* Barcode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', height: 60, marginBottom: 32, gap: 2 }}>
            {Array.from({length: 40}).map((_, i) => (
              <div key={i} style={{ width: Math.random() > 0.5 ? 4 : 2, background: '#000', height: '100%', opacity: Math.random() > 0.2 ? 1 : 0 }} />
            ))}
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
            {displaySteps.map((step, idx) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'flex-end', fontSize: 14, fontWeight: 800 }}>
                <span style={{ maxWidth: '75%', wordBreak: 'keep-all' }}>{step.text}</span>
                <div style={{ flex: 1, borderBottom: '2px dotted #000', margin: '0 8px', position: 'relative', top: -4 }}></div>
                <span>{(idx + 1).toString().padStart(2, '0')}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 800, textAlign: 'center', marginBottom: 24 }}>
            ********** SHORT INTERVIEW **********
          </div>

          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800 }}>
            T H A N K &nbsp;&nbsp;&nbsp;Y O U<br />
            HAVE A NICE DAY
          </div>
        </div>

        {/* Action Button outside receipt */}
        <button 
          className="neo-btn" 
          style={{ backgroundColor: '#FFF', color: '#191f28', width: '100%', maxWidth: 360, marginTop: 40 }}
          onClick={() => {
            if (isHistoryView) {
              setSelectedHistoryItem(null);
            } else {
              setGoal('');
              setSteps([]);
              setStartWhen('');
              setStartWhere('');
              setScreen('home');
            }
          }}
        >
          {isHistoryView ? '닫기' : '새로운 목표 시작하기'}
        </button>
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
      {selectedHistoryItem && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh', zIndex: 3000, overflowY: 'auto', background: '#000' }}>
          {renderReceipt(selectedHistoryItem)}
        </div>
      )}

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
