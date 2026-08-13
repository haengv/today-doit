import React, { useState, useEffect } from 'react';

export default function AdminPanel() {
  // Pre-fill draft from URL query param (used when clicking the Discord deep-link)
  const urlParams = new URLSearchParams(window.location.search);
  const draftFromUrl = urlParams.get('draft') || '';

  const [draft, setDraft] = useState(draftFromUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('empathy');

  const generateDraft = async () => {
    setIsGenerating(true);
    setMessage('');
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API Key missing");

      let topicInstruction = '';
      if (category === 'empathy') {
        topicInstruction = '주제: 회피형 인간이나 할 일을 미루는 사람들의 뼈를 때리거나 깊은 공감을 유도하는 내용';
      } else if (category === 'service') {
        topicInstruction = '주제: 할 일을 작게 쪼개는 두잇(DO IT) 서비스의 핵심 기능과 장점을 매력적으로 소개하는 내용';
      } else {
        topicInstruction = '주제: 일단 무작정 작게라도 시작해보자는 행동 촉구 및 동기부여 내용';
      }

      const prompt = `
당신은 '두잇(DO IT)' 이라는 생산성/할 일 관리 웹 서비스를 직접 만든 1인 메이커입니다.
두잇은 "목표를 아주 작게 쪼개어, 하나씩 완수하도록 돕는" 서비스이며, 회피형 인간이나 미루는 습관이 있는 사람들에게 유용합니다.

매일 스레드(Threads)에 올릴 짧고 매력적인 포스팅 초안을 작성해주세요.
${topicInstruction}

[필수 규칙 - 메이커의 말투를 완벽하게 따라할 것]
- 글자 수는 공백 포함 최대 200자를 절대 넘지 않게 아주 짧게 작성하세요!!
- 반드시 100% 반말로 작성하세요. (예: ~어, ~야, ~지?, ~사람!!, ~해봤어) 존댓말은 절대 금지입니다.
- 가르치려 들지 말고, 겪었던 고민을 털어놓으며 공감대를 형성하는 친구 같은 말투를 쓰세요. ("이거 나만 그런거 아니지?")
- 딱딱한 AI 느낌을 빼고 사람 냄새나는 이모티콘이나 특수문자(예: ꒰ • ̫ - ꒱⊹˚. 등)를 가끔 섞어주세요.
- 글의 마지막에는 자연스럽게 프로필 링크를 유도하거나 피드백을 구하는 질문을 던지세요. ("관심 있는 사람 있을까?", "써볼 사람!!")
- 해시태그는 넣지 마세요. 스레드 감성에 맞게 깔끔하게 끝내세요.

[메이커의 실제 작성 예시 참고]
- "오늘 할 일 하기 싫은 사람들!! 꼭 해야할 일 한가지만 적으면 단계별로 쪼개주는 서비스 만들어봤는데 사용해 볼 사람 ꒰ • ̫ - ꒱⊹˚."
- "요즘 할 일은 많은데 매번 미루고 시작을 못하게 되는 것 같아. 투두를 써도 늘 전부 완료하지 못하고 하기싫은 일은 나중으로 미루게 돼…. 이거 나만 그런거 아니지?"
- "하루에 딱 한가지 할 일만 적고 할 일을 단계별로 나눠서 쪼개주는 서비스를 만들어봤어. 간단한 기능이지만 피드백을 받고 싶은데 관심 있는 사람 있을까?"
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Failed to generate");

      const generatedText = data.candidates[0].content.parts[0].text;
      setDraft(generatedText);
      setMessage('초안 생성 완료!');
    } catch (err: any) {
      setMessage(`에러: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const publishToThreads = async () => {
    if (!draft.trim()) {
      setMessage('초안이 비어있습니다.');
      return;
    }

    setIsPublishing(true);
    setMessage('');

    try {
      const userId = import.meta.env.VITE_THREADS_USER_ID;
      const accessToken = import.meta.env.VITE_THREADS_ACCESS_TOKEN;

      if (!userId || !accessToken) {
        throw new Error("Threads API credentials missing in Vercel env");
      }

      // Step 1: Create media container
      const createParams = new URLSearchParams({
        media_type: 'TEXT',
        text: draft,
        access_token: accessToken
      });
      const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads?${createParams.toString()}`, {
        method: 'POST',
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(JSON.stringify(createData.error) || "Failed to create container");

      const creationId = createData.id;

      // Wait a moment for Meta to process the container
      await new Promise(res => setTimeout(res, 3000));

      // Step 2: Publish container
      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken
      });
      const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish?${publishParams.toString()}`, {
        method: 'POST',
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(JSON.stringify(publishData.error) || "Failed to publish");

      setMessage('🎉 스레드 자동 발행 성공!');
      setDraft(''); // Clear draft after successful publish
    } catch (err: any) {
      setMessage(`에러: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 400, margin: '100px auto', fontFamily: "'Pretendard', sans-serif", textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>🔒 관리자 로그인</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>접근 권한이 필요합니다.</p>
        <input 
          type="password" 
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="비밀번호를 입력하세요"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && passwordInput === 'doitmaker!') {
              setIsAuthenticated(true);
            }
          }}
          style={{
            width: '100%', padding: 16, borderRadius: 8, border: '1px solid #CCC',
            fontSize: 16, marginBottom: 16, boxSizing: 'border-box'
          }}
        />
        <button 
          onClick={() => {
            if (passwordInput === 'doitmaker!') {
              setIsAuthenticated(true);
            } else {
              alert('비밀번호가 틀렸습니다.');
              setPasswordInput('');
            }
          }}
          style={{
            width: '100%', padding: 16, backgroundColor: '#130537', color: '#FFF',
            borderRadius: 8, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer'
          }}
        >
          입장하기
        </button>
        <div style={{ marginTop: 24 }}>
          <a href="/" style={{ color: '#666', textDecoration: 'underline' }}>← 홈으로 돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', fontFamily: "'Pretendard', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🤖 DO IT Auto Poster</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>AI가 스레드 포스팅 초안을 작성하고, 검수 후 원클릭으로 발행합니다.</p>
      
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>📝 오늘의 포스팅 카테고리 선택</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'empathy', label: '🫂 공감 유도' },
            { id: 'service', label: '✨ 서비스 홍보' },
            { id: 'motivation', label: '🔥 동기부여' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, fontSize: 14,
                backgroundColor: category === cat.id ? '#130537' : '#F2F3F5',
                color: category === cat.id ? '#FFF' : '#666',
                border: 'none', transition: 'all 0.2s'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <button 
        onClick={generateDraft} 
        disabled={isGenerating}
        style={{
          width: '100%', padding: 16, backgroundColor: '#000', color: '#FFF',
          borderRadius: 8, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
          marginBottom: 20
        }}
      >
        {isGenerating ? 'AI 초안 작성 중...' : '오늘의 스레드 초안 생성하기 ✨'}
      </button>

      <textarea 
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="생성된 초안이 여기에 나타납니다. 직접 수정할 수 있습니다."
        style={{
          width: '100%', height: 250, padding: 16, borderRadius: 8,
          border: '1px solid #CCC', fontSize: 15, lineHeight: 1.6,
          boxSizing: 'border-box', marginBottom: 20, resize: 'vertical'
        }}
      />

      <button 
        onClick={publishToThreads} 
        disabled={isPublishing || !draft}
        style={{
          width: '100%', padding: 16, backgroundColor: '#130537', color: '#FFF',
          borderRadius: 8, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
          opacity: (isPublishing || !draft) ? 0.5 : 1
        }}
      >
        {isPublishing ? '발행 중...' : '스레드에 자동 발행하기 🚀'}
      </button>

      {message && (
        <div style={{
          marginTop: 20, padding: 16, borderRadius: 8,
          backgroundColor: message.includes('에러') ? '#FEE2E2' : '#DCFCE7',
          color: message.includes('에러') ? '#991B1B' : '#166534',
          fontWeight: 600, textAlign: 'center'
        }}>
          {message}
        </div>
      )}
      
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <a href="/" style={{ color: '#666', textDecoration: 'underline' }}>← 홈으로 돌아가기</a>
      </div>
    </div>
  );
}
