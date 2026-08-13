import React, { useState } from 'react';

export default function AdminPanel() {
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState('');

  const generateDraft = async () => {
    setIsGenerating(true);
    setMessage('');
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API Key missing");

      const prompt = `
당신은 '두잇(DO IT)' 이라는 생산성/할 일 관리 웹 서비스의 마케터입니다.
두잇은 "목표를 아주 작게 쪼개어, 하나씩 완수하도록 돕는" 서비스이며, 회피형 인간이나 미루는 습관이 있는 사람들에게 특히 유용합니다.

매일 스레드(Threads)에 올릴 짧고 매력적인 포스팅 초안을 작성해주세요.
내용에는 다음 중 하나를 포함하세요:
1. 행동을 잘게 쪼개는 것(Micro-stepping)의 중요성
2. 의지력을 믿지 말고 환경과 시스템을 만들라는 조언
3. 의사결정 피로도(Decision Fatigue)를 줄이는 팁
4. 무작정 시작하기(Just start)의 힘

규칙:
- 스레드 특성에 맞게 짧고 간결하게 작성하세요.
- 친근하고 동기부여가 되는 어조를 사용하세요.
- 이모지를 적절히 사용하세요.
- 글의 마지막에는 자연스럽게 "행동을 쪼개고 싶다면 프로필 링크를 확인해 보세요!" 같은 콜투액션(CTA)을 살짝 넣어주세요.
- 해시태그는 #생산성 #동기부여 #자기계발 등 2~3개만 넣어주세요.
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
      const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'TEXT',
          text: draft,
          access_token: accessToken
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error?.message || "Failed to create container");

      const creationId = createData.id;

      // Wait a moment for Meta to process the container
      await new Promise(res => setTimeout(res, 3000));

      // Step 2: Publish container
      const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken
        })
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishData.error?.message || "Failed to publish");

      setMessage('🎉 스레드 자동 발행 성공!');
      setDraft(''); // Clear draft after successful publish
    } catch (err: any) {
      setMessage(`에러: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', fontFamily: "'Pretendard', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🤖 DO IT Auto Poster</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>AI가 스레드 포스팅 초안을 작성하고, 검수 후 원클릭으로 발행합니다.</p>
      
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
