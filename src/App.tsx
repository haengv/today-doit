import React, { useState, useEffect } from 'react';

type TabState = 'home' | 'history';
type ScreenState = 'onboarding' | 'home' | 'breakdown' | 'action' | 'receipt';

type Step = {
  id: string;
  text: string;
  completed: boolean;
  timeEstimate: number;
};

const simulateBreakdown = (goal: string): Promise<Step[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { id: '1', text: '일단 노트북 전원 켜기', completed: false, timeEstimate: 2 },
        { id: '2', text: '작업할 폴더 및 파일 생성하기', completed: false, timeEstimate: 5 },
        { id: '3', text: '관련 자료 검색 및 수집하기', completed: false, timeEstimate: 15 },
        { id: '4', text: '초안 작성 시작하기', completed: false, timeEstimate: 30 },
      ]);
    }, 1500);
  });
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
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [isMicroBreaking, setIsMicroBreaking] = useState(false);
  const [history, setHistory] = useState<{id: number, text: string, date: string}[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [postItColor, setPostItColor] = useState('#FEF9C3');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'action') {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [screen]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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
      ←
    </button>
  );

  const renderHome = () => {
    const today = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'long' };
    const dateString = today.toLocaleDateString('ko-KR', dateOptions);

    const completedCount = steps.filter(s => s.completed).length;
    const totalCount = steps.length;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const hasActiveGoal = goal.trim() !== '' && steps.length > 0;
    const allCompleted = hasActiveGoal && completedCount === totalCount;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', minHeight: '100vh', background: '#F8F9FA', paddingBottom: 100 }}>
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'left', marginBottom: 32, marginTop: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#191f28', margin: '0 0 16px 0' }}>
            {dateString}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#191f28', margin: 0, wordBreak: 'keep-all', lineHeight: 1.5 }}>
              "기회는 새와 같은 것 날아가기 전에 꼭 잡아야 한다."
            </p>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#8B95A1' }}>스마일즈</span>
          </div>
        </div>
        
        <div style={{ width: '100%', maxWidth: 320 }}>
          {/* Post-it UI Goal Card */}
          <div 
            onClick={() => !hasActiveGoal && setIsBottomSheetOpen(true)}
            style={{ 
              position: 'relative', width: '100%', minHeight: 180, backgroundColor: postItColor, 
              border: '2px solid #191f28', boxShadow: '4px 4px 0px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: hasActiveGoal ? 'default' : 'pointer', padding: '32px 24px 24px', marginBottom: 28,
              transform: 'rotate(-1deg)'
            }}
          >
            {/* Masking Tape */}
            <div style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%) rotate(2deg)',
              width: 80, height: 24, backgroundColor: '#E5E7EB', opacity: 0.9, border: '1px solid #191f28'
            }} />
            
            {/* Blue Star Decoration */}
            <div style={{ position: 'absolute', bottom: -12, right: -12, transform: 'rotate(15deg)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#93C5FD" stroke="#191f28" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>

            <h2 style={{ fontSize: 13, color: '#4B5563', fontWeight: 800, marginBottom: 16, letterSpacing: 1 }}>TODAY'S GOAL</h2>
            
            {!hasActiveGoal ? (
              isBottomSheetOpen ? (
                <textarea
                  className="handwriting"
                  placeholder="예) 포트폴리오 첫 장 만들기"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  autoFocus
                  style={{ 
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    textAlign: 'center',
                    fontSize: 26, 
                    fontWeight: 800, 
                    color: '#191f28', 
                    lineHeight: 1.3,
                    overflow: 'hidden'
                  }}
                  rows={2}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#9CA3AF' }}>
                  <div style={{ fontSize: 32, fontWeight: 300, lineHeight: 1 }}>+</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>할 일을 추가해보세요</div>
                </div>
              )
            ) : (
              <h1 className="handwriting" style={{ fontSize: 26, fontWeight: 800, color: '#191f28', margin: 0, wordBreak: 'keep-all', textAlign: 'center', lineHeight: 1.3 }}>
                {goal}
              </h1>
            )}
          </div>

          {/* Dynamic Bottom Area */}
          {!hasActiveGoal ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🌱</div>
              <p style={{ fontSize: 16, fontWeight: 700 }}>아직 오늘의 목표를 설정하지 않았어요.<br/>위 버튼을 눌러 시작해보세요!</p>
            </div>
          ) : (
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
                  onClick={() => setScreen('action')}
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
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'transparent', zIndex: 2000,
        }}
      />
      <div 
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, 
          backgroundColor: '#FFF', borderTop: '3px solid #191f28',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '24px 24px 40px', zIndex: 2001,
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ width: 40, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 24 }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#4E5968', marginBottom: 16 }}>포스트잇 색상을 골라주세요</h2>

        {/* Color Palette */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          {['#FEF9C3', '#FBCFE8', '#BAE6FD', '#D1FAE5'].map(color => (
            <div 
              key={color}
              onClick={() => setPostItColor(color)}
              style={{
                width: 36, height: 36, borderRadius: '50%', backgroundColor: color,
                border: postItColor === color ? '3px solid #191f28' : '2px solid #E5E7EB',
                cursor: 'pointer',
                transform: postItColor === color ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.2s ease',
                boxShadow: postItColor === color ? '2px 2px 0px rgba(0,0,0,0.2)' : 'none'
              }}
            />
          ))}
        </div>

        <button 
          className="neo-btn" style={{ backgroundColor: '#A7F3D0', width: '100%' }}
          onClick={async () => {
            if (!goal.trim()) return;
            
            setHistory(prev => [{id: Date.now(), text: goal, date: new Date().toLocaleDateString()}, ...prev]);
            
            setIsBottomSheetOpen(false);
            setScreen('breakdown');
            setIsBreakingDown(true);
            const newSteps = await simulateBreakdown(goal);
            setSteps(newSteps);
            setIsBreakingDown(false);
          }}
        >
          목표 설정 완료하기
        </button>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );

  const renderBreakdown = () => (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 20px', minHeight: '100vh', background: '#FCE7F3', paddingBottom: 140 }}>
      {isBreakingDown ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="anim-float" style={{ fontSize: 60, marginBottom: 20 }}>🪄</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}>목표를 아주 잘게<br />부수고 있어요...</h2>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 20 }}>
            {renderBackButton(() => setScreen('input'))}
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#191f28', margin: 0 }}>
              순서를 바꿀 수 있어요!
            </h1>
          </div>
          
          {/* Main Goal Display */}
          <div className="neo-card" style={{ marginBottom: 24, padding: 20, backgroundColor: postItColor, border: '3px solid #191f28', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#B45309' }}>오늘의 단 하나 (목표)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#191f28', wordBreak: 'keep-all' }}>{goal}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {steps.map((step, idx) => {
              const isFirst = idx === 0;
              return (
                <div 
                  key={step.id} 
                  draggable
                  onDragStart={(e) => {
                    setDraggedItemIndex(idx);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnter={(e) => {
                    if (draggedItemIndex === null || draggedItemIndex === idx) return;
                    const newSteps = [...steps];
                    const item = newSteps.splice(draggedItemIndex, 1)[0];
                    newSteps.splice(idx, 0, item);
                    setDraggedItemIndex(idx);
                    setSteps(newSteps);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => setDraggedItemIndex(null)}
                  className="neo-card"
                  style={{ 
                    backgroundColor: isFirst ? '#FFFFFF' : '#F3F4F6', padding: 20,
                    border: isFirst ? '3px solid #3B82F6' : '3px solid #191f28',
                    position: 'relative', display: 'flex', flexDirection: 'column', gap: 12,
                    opacity: draggedItemIndex === idx ? 0.5 : 1
                  }}
                >
                  {isFirst && (
                    <div style={{ 
                      position: 'absolute', top: -14, left: 16, background: '#3B82F6', color: '#FFF', 
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, border: '2px solid #000' 
                    }}>
                      ⏳ 2분 안에 가능한 첫 걸음
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: isFirst ? 8 : 0 }}>
                    {/* Drag Handle */}
                    <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', marginRight: 4 }}>
                      <svg width="12" height="20" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2" cy="3" r="1.5" />
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="2" cy="8" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="2" cy="13" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#191f28', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    {/* Editable Text Input */}
                    {editingStepId === step.id ? (
                      <input 
                        autoFocus
                        value={step.text}
                        onChange={e => updateStepText(idx, e.target.value)}
                        onBlur={() => setEditingStepId(null)}
                        onKeyDown={e => { if (e.key === 'Enter') setEditingStepId(null) }}
                        style={{
                          flex: 1, fontSize: 16, fontWeight: 700, color: '#191f28',
                          border: 'none', background: 'transparent', outline: 'none',
                          borderBottom: '2px dashed #191f28', paddingBottom: 4
                        }}
                      />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#191f28', wordBreak: 'keep-all' }}>{step.text}</div>
                          <span style={{ fontSize: 12, backgroundColor: '#E5E7EB', padding: '2px 8px', borderRadius: 12, color: '#4E5968', width: 'fit-content' }}>⏱️ {step.timeEstimate}분</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button 
                            onClick={() => setEditingStepId(step.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, fontSize: 16, flexShrink: 0 }}
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => {
                              const newSteps = steps.filter(s => s.id !== step.id);
                              setSteps(newSteps);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, fontSize: 16, flexShrink: 0 }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isFirst && (
                    <button 
                      onClick={async () => {
                        if(isMicroBreaking) return;
                        setIsMicroBreaking(true);
                        const microText = await simulateMicroBreakdown();
                        updateStepText(0, microText);
                        setIsMicroBreaking(false);
                      }}
                      style={{ 
                        alignSelf: 'flex-start', background: '#FDE047', border: '2px solid #000', 
                        borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 700, 
                        cursor: 'pointer', opacity: isMicroBreaking ? 0.5 : 1
                      }}
                    >
                      이것도 부담되나요? 더 작게 쪼개기
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', background: '#FCE7F3', borderTop: '3px solid #191f28', zIndex: 100 }}>
            <button 
              className="neo-btn" 
              style={{ backgroundColor: '#3B82F6', color: '#FFF', width: '100%' }}
              onClick={() => setScreen('action')}
            >
              첫 번째 행동 지금 바로 시작하기
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderAction = () => {
    const currentStepIndex = steps.findIndex(s => !s.completed);
    const currentStep = steps[currentStepIndex];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#DDD6FE', padding: 20, paddingBottom: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 40, left: 20 }}>
          {renderBackButton(() => {
            if (window.confirm('현재 진행 중인 행동이 있습니다. 타이머를 멈추고 정말 나가시겠습니까?')) {
              setScreen('home');
            }
          })}
        </div>
        <div 
          className="neo-card anim-pop"
          style={{ width: '100%', maxWidth: 320, padding: 40, backgroundColor: '#FFF', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#4E5968', marginBottom: 12 }}>현재 진행 중인 행동</h2>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#191f28', marginBottom: 24, wordBreak: 'keep-all' }}>
            {currentStep?.text || '모든 할 일을 마쳤습니다!'}
          </h1>
          
          {/* Mini Timeline */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, textAlign: 'left', background: '#F3F4F6', padding: 16, borderRadius: 12, border: '2px solid #191f28' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 4px 0', color: '#4E5968' }}>진행 상황</h3>
            {steps.map((step, idx) => {
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: step.completed ? 0.4 : (isCurrent ? 1 : 0.6) }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: step.completed ? '#10B981' : (isCurrent ? '#3B82F6' : '#9CA3AF'), color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                    {step.completed ? '✓' : (isCurrent ? '▶' : '')}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: isCurrent ? 800 : 700, color: '#191f28', textDecoration: step.completed ? 'line-through' : 'none', wordBreak: 'keep-all' }}>
                    {step.text}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Stopwatch */}
          <div style={{ 
            fontSize: 56, fontWeight: 800, fontFamily: 'monospace', 
            background: '#191f28', color: '#FFF', padding: '16px 32px', 
            borderRadius: 16, border: '4px solid #000', marginBottom: 40,
            boxShadow: '4px 4px 0px #FDE047'
          }}>
            {formatTime(elapsedSeconds)}
          </div>

          <button 
            className="neo-btn" 
            style={{ backgroundColor: '#10B981', color: '#FFF', width: '100%' }}
            onClick={() => {
              if (currentStep) {
                const newSteps = [...steps];
                newSteps[currentStepIndex].completed = true;
                setSteps(newSteps);
                
                const remainingSteps = newSteps.filter(s => !s.completed);
                if (remainingSteps.length > 0) {
                  setElapsedSeconds(0);
                } else {
                  alert('🎉 오늘의 모든 행동을 완료했습니다! 수고하셨어요!');
                  setScreen('home');
                }
              } else {
                setScreen('home');
              }
            }}
          >
            해냈어요! (완료)
          </button>
        </div>
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
        <div style={{ display: 'flex', width: '100%', border: '3px solid #191f28', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <button 
            onClick={() => setHistoryView('list')}
            style={{ flex: 1, padding: 12, fontSize: 16, fontWeight: 800, background: historyView === 'list' ? '#191f28' : '#FFF', color: historyView === 'list' ? '#FFF' : '#191f28', border: 'none', borderRight: '3px solid #191f28', cursor: 'pointer' }}
          >
            📝 리스트
          </button>
          <button 
            onClick={() => setHistoryView('calendar')}
            style={{ flex: 1, padding: 12, fontSize: 16, fontWeight: 800, background: historyView === 'calendar' ? '#191f28' : '#FFF', color: historyView === 'calendar' ? '#FFF' : '#191f28', border: 'none', cursor: 'pointer' }}
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
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {history.map(item => (
                 <div key={item.id} className="neo-card" style={{ padding: 20, border: '3px solid #191f28', backgroundColor: '#FFFFFF' }}>
                   <div style={{ fontSize: 14, color: '#4E5968', fontWeight: 800, marginBottom: 8 }}>{item.date}</div>
                   <div style={{ fontSize: 18, fontWeight: 800, color: '#191f28', wordBreak: 'keep-all' }}>{item.text}</div>
                 </div>
              ))}
            </div>
          )
        )}
      </div>
    );
  };

  const renderReceipt = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000', padding: '40px 20px', paddingBottom: 100 }}>
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

          <div style={{ display: 'flex', gap: 16, fontSize: 16, fontWeight: 800, marginBottom: 24 }}>
            <span style={{ flexShrink: 0 }}>목표 :</span>
            <span style={{ wordBreak: 'keep-all' }}>{goal}</span>
          </div>

          {/* Barcode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', height: 60, marginBottom: 32, gap: 2 }}>
            {Array.from({length: 40}).map((_, i) => (
              <div key={i} style={{ width: Math.random() > 0.5 ? 4 : 2, background: '#000', height: '100%', opacity: Math.random() > 0.2 ? 1 : 0 }} />
            ))}
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
            {steps.map((step, idx) => (
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

        {/* Reset Button outside receipt */}
        <button 
          className="neo-btn" 
          style={{ backgroundColor: '#FFF', color: '#191f28', width: '100%', maxWidth: 360, marginTop: 40 }}
          onClick={() => {
            setGoal('');
            setSteps([]);
            setScreen('home');
          }}
        >
          새로운 목표 시작하기
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
      
      {/* Bottom Sheet Overlay */}
      {isBottomSheetOpen && renderBottomSheet()}
      
      {tab === 'history' && renderHistory()}

      {/* Bottom Navigation Tab Bar */}
      {screen !== 'onboarding' && screen !== 'breakdown' && screen !== 'receipt' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#FFF', borderTop: '3px solid #191f28',
          display: 'flex', height: 80, zIndex: 1000
        }}>
        <div 
          onClick={() => { setTab('home'); setScreen('home'); }}
          style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: tab === 'home' ? '#E5E7EB' : '#FFF', cursor: 'pointer',
            borderRight: '3px solid #191f28'
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>🏠</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#191f28' }}>홈</div>
        </div>
        <div 
          onClick={() => setTab('history')}
          style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: tab === 'history' ? '#E5E7EB' : '#FFF', cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>🗂</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#191f28' }}>기록</div>
        </div>
      </div>
      )}
    </div>
  );
}
