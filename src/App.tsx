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
  
  const [pressProgress, setPressProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startPress = () => {
    startTimeRef.current = Date.now();
    
    const animate = () => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / 3500) * 100, 100);
      setPressProgress(progress);
      
      if (progress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null;
        setPressProgress(0);
        setActionStartTime(new Date());
        setScreen('action');
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  const endPress = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    startTimeRef.current = null;
    setPressProgress(0);
  };
  const [bottomSheetStep, setBottomSheetStep] = useState<1 | 2>(1);
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>
        <div style={{ width: '100%', maxWidth: 335, textAlign: 'left', marginBottom: 32, marginTop: 12 }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
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
            <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: '#F3F4F6', border: '1.5px solid #191f28', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/assets/img-character.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <div style={{ position: 'absolute', top: 140.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: 'rgba(3,24,50,0.46)' }}>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>오늘 꼭 해야 할</span>
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5 }}>한가지 일을 적어주세요</span>
                </div>
              ) : (
                <div style={{ position: 'absolute', top: 130.5, left: 16.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
                  const newSteps = await simulateBreakdown(goal);
                  setSteps(newSteps);
                  setHistory(prev => prev.map(h => h.id === historyId ? { ...h, steps: newSteps } : h));
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
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            <img src="/assets/icon-edit.svg" alt="수정" style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,19,43,0.58)' }}>직접 수정하기</span>
          </button>
        </div>

        {/* Steps List */}
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
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
      </div>

      {/* Bottom CTA */}
      <div style={{ position: 'sticky', bottom: 0, width: '100%', padding: '20px', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 20%)', zIndex: 100, boxSizing: 'border-box', marginTop: 'auto' }}>
        <button 
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          style={{ 
            background: pressProgress > 0 
              ? `linear-gradient(90deg, #93c5fd ${pressProgress}%, #c5e3ff ${pressProgress}%)`
              : '#c5e3ff',
            border: pressProgress > 0 ? '1.5px solid #2563eb' : '1.5px solid rgba(0,12,30,0.8)',
            borderRadius: 16,
            width: '100%', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 600, color: '#130537' }}>꾹 눌러 첫 행동 시작</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#130537" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );

  const renderAction = () => {
    const currentStepIndex = steps.findIndex(s => !s.completed);
    const currentStep = steps[currentStepIndex];

    const timeString = actionStartTime 
      ? actionStartTime.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
      : '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F8F9FA', padding: 20, paddingBottom: 100, position: 'relative' }}>
        <div 
          className="neo-card anim-pop"
          style={{ width: '100%', maxWidth: 320, padding: '40px 24px', backgroundColor: '#FFF', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {/* Top: Goal */}
          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#3B82F6', marginBottom: 8, background: '#EFF6FF', padding: '4px 12px', borderRadius: 16 }}>오늘 목표</h3>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#191f28', marginBottom: 24, wordBreak: 'keep-all' }}>{goal}</h2>
          
          <div style={{ width: '100%', height: '1.5px', background: '#E5E7EB', marginBottom: 32 }} />

          {/* Main: Current Step */}
          <p style={{ fontSize: 14, fontWeight: 700, color: '#4E5968', marginBottom: 12 }}>지금은 이것만 해볼까요?</p>
          <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            {/* Pulsing indicator background */}
            <div style={{ position: 'absolute', width: 80, height: 80, background: '#DBEAFE', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#191f28', margin: 0, wordBreak: 'keep-all', position: 'relative', zIndex: 1, padding: '0 20px' }}>
              [ {currentStep?.text || '모든 할 일을 마쳤습니다!'} ]
            </h1>
            <style>{`@keyframes pulse { 0% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.4); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }`}</style>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#9CA3AF', marginBottom: 40 }}>
            {currentStepIndex + 1} / {steps.length} step
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, color: '#3B82F6', marginBottom: 8 }}>지금 시작했어요 🚀</div>
          <div style={{ fontSize: 13, color: '#4E5968', marginBottom: 40 }}>({timeString} 시작)</div>

          {/* Bottom text */}
          <p style={{ fontSize: 14, color: '#8B95A1', marginBottom: 24 }}>처음 시작하는 게 가장 어려워요.<br/>가벼운 마음으로 딱 이것만 해봐요!</p>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button 
              className="neo-btn" 
              style={{ backgroundColor: '#10B981', color: '#FFF', width: '100%', padding: '16px 0', fontSize: 16 }}
              onClick={() => {
                if (currentStep) {
                  setShowActionPopup(true);
                } else {
                  setScreen('home');
                }
              }}
            >
              좋아요, 했어요
            </button>
            <button 
              className="neo-btn" 
              style={{ backgroundColor: '#F3F4F6', color: '#4E5968', width: '100%', padding: '16px 0', fontSize: 16 }}
              onClick={() => {
                if (window.confirm('현재 진행 중인 행동이 있습니다. 정말 멈추시겠습니까?')) {
                  setScreen('home');
                }
              }}
            >
              잠깐 멈출게요
            </button>
          </div>
        </div>

        {/* Action Completion Popup */}
        {showActionPopup && (
          <div style={{
            position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 375, height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 4000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <div className="neo-card anim-pop" style={{ width: '100%', maxWidth: 320, padding: 32, backgroundColor: '#FFF', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👏</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#191f28', marginBottom: 8 }}>정말 해내셨군요! 고생했어요</h2>
              <p style={{ fontSize: 15, color: '#4E5968', marginBottom: 32, wordBreak: 'keep-all' }}>진짜 완벽하게 마무리하셨나요?</p>
              
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button 
                  className="neo-btn" 
                  style={{ backgroundColor: '#191f28', color: '#FFF', width: '100%', padding: '16px 0', fontSize: 16 }}
                  onClick={() => {
                    const newSteps = [...steps];
                    newSteps[currentStepIndex].completed = true;
                    setSteps(newSteps);
                    
                    const remainingSteps = newSteps.filter(s => !s.completed);
                    if (remainingSteps.length > 0) {
                      setActionStartTime(new Date());
                      setShowActionPopup(false);
                    } else {
                      setShowActionPopup(false);
                      alert('🎉 오늘의 모든 행동을 완료했습니다! 수고하셨어요!');
                      setScreen('home');
                    }
                  }}
                >
                  네! 다음 행동으로 넘어갈게요
                </button>
                <button 
                  className="neo-btn" 
                  style={{ backgroundColor: '#F3F4F6', color: '#4E5968', width: '100%', padding: '16px 0', fontSize: 16 }}
                  onClick={() => {
                    // Mark as completed but go back to home to rest
                    const newSteps = [...steps];
                    newSteps[currentStepIndex].completed = true;
                    setSteps(newSteps);
                    setShowActionPopup(false);
                    setScreen('home');
                  }}
                >
                  나중에 다시 할게요 (홈으로)
                </button>
              </div>
            </div>
          </div>
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
