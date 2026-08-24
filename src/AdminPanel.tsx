import React, { useState, useEffect, useRef } from 'react';

interface Reply {
  id: string;
  text: string;
  timestamp: string;
}

interface Thread {
  id: string;
  text: string;
}

interface Variation {
  id: string; // e.g. H2-SITUATION-03
  text: string;
}

const hypothesisDescriptions: Record<string, string> = {
  H1: 'H1 시작 부담: 해야 할 일을 알고 있지만 시작 자체가 크게 느껴져 미루는 문제',
  H2: 'H2 첫 행동 불명확: 해야 할 일은 알지만 무엇부터 해야 할지 몰라 시작하지 못하는 문제',
  H3: 'H3 너무 많은 할 일: 해야 할 일이 많아질수록 부담이 커져 아무것도 시작하지 못하는 문제',
  H4: 'H4 작은 시작: 완료 압박보다 아주 작은 첫 행동이 시작하는 데 도움이 된다는 가치',
};

const hypothesisShortNames: Record<string, string> = {
  H1: 'START_BURDEN',
  H2: 'FIRST_ACTION_UNCLEAR',
  H3: 'TOO_MANY_TASKS',
  H4: 'SMALL_START',
};

const contentTypeDescriptions: Record<string, string> = {
  EMPATHY: '공감',
  SITUATION: '상황 묘사',
  QUESTION: '질문',
};

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Selections for Hypothesis and Content Type
  const [hypothesis, setHypothesis] = useState<string>('H1');
  const [contentType, setContentType] = useState<string>('EMPATHY');

  // Variations state
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIds, setRegeneratingIds] = useState<Record<string, boolean>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState('');

  // Replies states
  const [recentThread, setRecentThread] = useState<Thread | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');

  // Helper to generate Experiment IDs
  const generateExperimentId = (hypKey: string, typeKey: string, number: number) => {
    return `${hypKey}-${typeKey}-0${number}`;
  };

  // 5 Variations Generation API
  const generateAllDrafts = async () => {
    setIsGenerating(true);
    setMessage('');
    setVariations([]);
    setSelectedVariationId(null);
    setEditingId(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API Key missing");

      const prompt = `
당신은 회피형 인간이나 할 일을 미루는 사람들을 위한 생산성 도구를 만드는 1인 메이커이자, 스레드(Threads)에서 활발히 활동하는 30대 창업가입니다.

이번에 검증하려는 메시지 가설과 표현 방식은 다음과 같습니다:
- 검증할 메시지 가설: [${hypothesis}] ${hypothesisDescriptions[hypothesis]}
- 콘텐츠 표현 방식: [${contentType}] ${contentTypeDescriptions[contentType]}

위 조건에 맞춰 스레드에 올릴 서로 다른 5개의 글 초안(variation)을 생성해주세요.

[필수 작성 규칙]
1. 한 게시물에는 오직 선택된 하나의 메시지 가설 내용만 포함해야 합니다. 다른 문제 가설이나 해결책을 섞지 마세요.
2. 우리 서비스(DO IT)의 이름을 직접 홍보하거나 언급하지 마세요. (예: "두잇을 써봐" 등의 서비스 언급 금지)
3. 해결책을 먼저 제안하지 마세요. 사용자가 겪는 문제 상황과 감정에 초점을 맞춥니다.
4. 실제 개인이 스레드에 올리는 매우 자연스러운 한국어 구어체 반말(~어, ~야, ~지?)로 작성하세요. 광고 카피나 번역기 말투처럼 절대 쓰지 마세요.
5. 분량은 글당 2문장에서 5문장 정도로 작성하세요.
6. 이모지는 과도하게 쓰지 말고, 글당 최대 1~2개만 자연스럽게 사용하세요.
7. 사용자가 자신의 일상 경험(예: 노트북 열기 전 밍기적거림, 해야 할 일을 에버노트에 정리만 해두는 행동 등)을 바로 떠올릴 수 있는 아주 구체적인 상황을 활용하세요.
8. 5개의 초안은 서로 다른 구체적인 상황과 뉘앙스를 담아야 하며, 단어만 바꾼 수준의 유사한 의미 반복이어서는 절대 안 됩니다.

귀하는 JSON 배열 형식으로만 응답해야 합니다. 다른 서설이나 코드 블록 기호(\`\`\`json 등) 없이 오직 JSON 배열만 반환하세요.
출력 예시:
[
  "첫 번째 초안 내용...",
  "두 번째 초안 내용...",
  "세 번째 초안 내용...",
  "네 번째 초안 내용...",
  "다섯 번째 초안 내용..."
]
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Failed to generate");

      let rawText = data.candidates[0].content.parts[0].text.trim();
      if (rawText.startsWith('```json')) {
        rawText = rawText.substring(7);
      }
      if (rawText.endsWith('```')) {
        rawText = rawText.substring(0, rawText.length - 3);
      }
      rawText = rawText.trim();

      const parsedDrafts = JSON.parse(rawText);
      if (!Array.isArray(parsedDrafts) || parsedDrafts.length < 5) {
        throw new Error("Invalid output received from Gemini API - expected at least 5 elements");
      }

      const generatedVariations = parsedDrafts.slice(0, 5).map((text, idx) => ({
        id: generateExperimentId(hypothesis, contentType, idx + 1),
        text: text.trim()
      }));

      setVariations(generatedVariations);
      setSelectedVariationId(generatedVariations[0].id); // Select first by default
      setMessage('5개의 초안 생성 완료!');
    } catch (err: any) {
      setMessage(`에러: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Single Variation Regeneration API
  const regenerateSingleDraft = async (variationId: string, idx: number) => {
    setRegeneratingIds(prev => ({ ...prev, [variationId]: true }));
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API Key missing");

      const prompt = `
당신은 할 일을 미루는 사람들을 위한 생산성 도구를 만드는 1인 메이커입니다.
- 검증할 메시지 가설: [${hypothesis}] ${hypothesisDescriptions[hypothesis]}
- 콘텐츠 표현 방식: [${contentType}] ${contentTypeDescriptions[contentType]}

위 조건에 맞춰 스레드에 올릴 자연스러운 1개의 글 초안을 새로 생성해주세요.
규칙:
1. 선택된 가설 하나만 다룹니다.
2. 서비스 이름(DO IT)을 언급하거나 홍보하지 마세요.
3. 해결책을 먼저 제시하지 마세요.
4. 구체적인 일상적 미루기 상황을 묘사하고, 자연스러운 한국어 구어체 반말을 사용하세요.
5. 분량은 2~5문장이며 광고 카피처럼 쓰지 마세요.
6. 이모지는 최소화하세요.

귀하는 JSON 형식으로 응답해야 합니다. 다음 키를 가진 JSON 객체 하나만 반환하세요: { "draft": "생성된 초안 내용..." }
다른 서설 없이 오직 이 JSON 객체만 반환하세요.
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Failed to generate");

      let rawText = data.candidates[0].content.parts[0].text.trim();
      if (rawText.startsWith('```json')) {
        rawText = rawText.substring(7);
      }
      if (rawText.endsWith('```')) {
        rawText = rawText.substring(0, rawText.length - 3);
      }
      rawText = rawText.trim();

      const parsed = JSON.parse(rawText);
      const newText = parsed.draft || parsed[Object.keys(parsed)[0]]; // Safe fallback
      
      if (!newText) throw new Error("Could not parse draft text");

      setVariations(prev => prev.map(v => v.id === variationId ? { ...v, text: newText.trim() } : v));
      showToast(`⚡️ ${variationId} 초안이 새로 생성되었습니다.`);
    } catch (err: any) {
      alert(`초안 재생성 실패: ${err.message}`);
    } finally {
      setRegeneratingIds(prev => ({ ...prev, [variationId]: false }));
    }
  };

  // Edit Handlers
  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const saveEdit = (id: string) => {
    setVariations(prev => prev.map(v => v.id === id ? { ...v, text: editText } : v));
    setEditingId(null);
  };

  // Threads Publish with backend DB logging
  const publishToThreads = async () => {
    const selectedVariation = variations.find(v => v.id === selectedVariationId);
    if (!selectedVariation) {
      setMessage('선택된 초안이 없습니다.');
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
      console.log('[Threads Publish] Creating container...');
      const createParams = new URLSearchParams({
        media_type: 'TEXT',
        text: selectedVariation.text,
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
      console.log('[Threads Publish] Publishing container...');
      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken
      });
      const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish?${publishParams.toString()}`, {
        method: 'POST',
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(JSON.stringify(publishData.error) || "Failed to publish");

      const threadsPostId = publishData.id || creationId;
      setMessage('🎉 스레드 자동 발행 성공!');

      // Step 3: Log experiment data to backend DB
      console.log('[Backend Logging] Saving experiment metadata...');
      const logRes = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: `exp_${Date.now().toString(36)}`,
          hypothesis_id: hypothesis,
          hypothesis_name: hypothesisDescriptions[hypothesis],
          content_type: contentType,
          variation_id: selectedVariation.id,
          content: selectedVariation.text,
          threads_post_id: threadsPostId
        })
      });

      if (!logRes.ok) {
        console.warn('Backend logging failed, but Threads post succeeded.');
      } else {
        console.log('[Backend Logging] Experiment saved successfully.');
      }

      // Clear variations after successful publish
      setVariations([]);
      setSelectedVariationId(null);
    } catch (err: any) {
      setMessage(`에러: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Toast handler
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Reply functions (Preserved original code)
  const fetchRecentReplies = async () => {
    setIsFetchingReplies(true);
    setReplyMessage('');
    try {
      const userId = import.meta.env.VITE_THREADS_USER_ID;
      const accessToken = import.meta.env.VITE_THREADS_ACCESS_TOKEN;
      if (!userId || !accessToken) throw new Error("Threads API credentials missing");

      const threadsRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads?access_token=${accessToken}`);
      const threadsData = await threadsRes.json();
      if (!threadsRes.ok) throw new Error(JSON.stringify(threadsData.error));

      if (!threadsData.data || threadsData.data.length === 0) {
        setReplyMessage('작성된 스레드 포스팅이 없습니다.');
        return;
      }
      
      const latestThread = threadsData.data[0];
      setRecentThread(latestThread);

      const repliesRes = await fetch(`https://graph.threads.net/v1.0/${latestThread.id}/replies?access_token=${accessToken}`);
      const repliesData = await repliesRes.json();
      if (!repliesRes.ok) throw new Error(JSON.stringify(repliesData.error));

      setReplies(repliesData.data || []);
      if (!repliesData.data || repliesData.data.length === 0) {
        setReplyMessage('최근 포스팅에 아직 댓글이 없습니다.');
      } else {
        setReplyMessage('댓글을 성공적으로 불러왔습니다.');
      }
    } catch (err: any) {
      setReplyMessage(`댓글 불러오기 에러: ${err.message}`);
    } finally {
      setIsFetchingReplies(false);
    }
  };

  const generateReplyDraft = async (replyId: string, replyText: string) => {
    try {
      setReplyMessage('답글 초안 생성 중...');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API Key missing");

      const prompt = `
당신은 '두잇(DO IT)' 이라는 생산성/할 일 관리 서비스를 만든 1인 메이커입니다.
당신이 스레드에 올린 포스팅에 누군가 다음과 같은 댓글을 달았습니다:
"${replyText}"

이 댓글에 대한 친절하고 센스 있는 반말 답글을 150자 이내로 작성해주세요.
- 필수 규칙: 100% 반말, 가르치려 들지 않는 친구 같은 공감형 말투, 귀여운 이모티콘 사용 (예: ꒰ • ̫ - ꒱⊹˚. 등)
- 절대 존댓말 쓰지 마세요.
`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to generate");

      const generatedText = data.candidates[0].content.parts[0].text;
      
      setReplyDrafts(prev => ({ ...prev, [replyId]: generatedText }));
      setReplyMessage('답글 초안 생성 완료!');
    } catch (err: any) {
      setReplyMessage(`AI 초안 생성 에러: ${err.message}`);
    }
  };

  const publishReply = async (replyId: string) => {
    const draftText = replyDrafts[replyId];
    if (!draftText) return;

    try {
      setReplyMessage('답글 발행 중...');
      const userId = import.meta.env.VITE_THREADS_USER_ID;
      const accessToken = import.meta.env.VITE_THREADS_ACCESS_TOKEN;

      const createParams = new URLSearchParams({
        media_type: 'TEXT',
        text: draftText,
        reply_to_id: replyId,
        access_token: accessToken
      });
      const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads?${createParams.toString()}`, { method: 'POST' });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(JSON.stringify(createData.error));

      const creationId = createData.id;
      await new Promise(res => setTimeout(res, 3000));

      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken
      });
      const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish?${publishParams.toString()}`, { method: 'POST' });
      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(JSON.stringify(publishData.error));

      setReplyMessage('🎉 답글 발행 성공!');
      
      setReplyDrafts(prev => {
        const newDrafts = { ...prev };
        delete newDrafts[replyId];
        return newDrafts;
      });
      
      setTimeout(fetchRecentReplies, 2000);
    } catch (err: any) {
      setReplyMessage(`답글 발행 에러: ${err.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 400, margin: '100px auto', fontFamily: "'Pretendard', sans-serif", textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>🔒 가설 실험 도구 로그인</h1>
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
    <div style={{ padding: '40px 20px', maxWidth: 650, margin: '0 auto', fontFamily: "'Pretendard', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🔬 사용자 메시지 가설 실험 도구</h1>
      <p style={{ color: '#666', marginBottom: 28, fontSize: 14, lineHeight: 1.5 }}>
        메시지 가설과 표현 방식을 선택하여 5개의 글 초안을 생성 및 비교하고, 최종 선택한 초안을 스레드에 발행하여 가설을 검증합니다.
      </p>

      {/* 🔧 환경변수 확인 */}
      <div style={{ marginBottom: 28, padding: 12, borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px dashed #CCC', fontSize: 13 }}>
        <p style={{ fontWeight: 700, marginBottom: 6, margin: 0 }}>🔧 환경변수 로드 상태</p>
        <span style={{ marginRight: 12 }}>GEMINI: {import.meta.env.VITE_GEMINI_API_KEY ? '✅' : '❌'}</span>
        <span style={{ marginRight: 12 }}>THREADS ID: {import.meta.env.VITE_THREADS_USER_ID ? '✅' : '❌'}</span>
        <span>THREADS TOKEN: {import.meta.env.VITE_THREADS_ACCESS_TOKEN ? '✅' : '❌'}</span>
      </div>

      {/* 1. 오늘 검증할 메시지 가설 */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>1. 오늘 검증할 메시지 가설</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.keys(hypothesisDescriptions).map(key => (
            <button
              key={key}
              onClick={() => setHypothesis(key)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                textAlign: 'left', fontWeight: hypothesis === key ? 700 : 500, fontSize: 13.5,
                backgroundColor: hypothesis === key ? '#130537' : '#F2F3F5',
                color: hypothesis === key ? '#FFF' : '#4B5563',
                border: hypothesis === key ? '1.5px solid #130537' : '1.5px solid transparent',
                transition: 'all 0.2s', lineHeight: 1.4
              }}
            >
              {hypothesisDescriptions[key]}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 콘텐츠 표현 방식 */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>2. 콘텐츠 표현 방식</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.keys(contentTypeDescriptions).map(key => (
            <button
              key={key}
              onClick={() => setContentType(key)}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, fontSize: 14,
                backgroundColor: contentType === key ? '#130537' : '#F2F3F5',
                color: contentType === key ? '#FFF' : '#4B5563',
                border: contentType === key ? '1.5px solid #130537' : '1.5px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {contentTypeDescriptions[key]}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 초안 생성 대형 버튼 */}
      <button 
        onClick={generateAllDrafts} 
        disabled={isGenerating}
        style={{
          width: '100%', padding: 16, backgroundColor: '#000', color: '#FFF',
          borderRadius: 8, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
          marginBottom: 28, transition: 'all 0.2s', opacity: isGenerating ? 0.7 : 1
        }}
      >
        {isGenerating ? 'AI가 초안 5개 쓰는 중...' : '가설별 초안 5개 생성하기 ✨'}
      </button>

      {/* 4. 초안 5개 비교 및 수정 영역 */}
      {variations.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>3. 초안 비교 및 편집</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {variations.map((v, idx) => {
              const isSelected = selectedVariationId === v.id;
              const isEditing = editingId === v.id;
              const isRegenerating = regeneratingIds[v.id] || false;

              return (
                <div 
                  key={v.id}
                  style={{
                    padding: 18, 
                    borderRadius: 12, 
                    border: isSelected ? '2px solid #3182F6' : '1.5px solid #E5E7EB',
                    backgroundColor: isSelected ? '#F8FAFC' : '#FFF',
                    boxShadow: isSelected ? '0 4px 12px rgba(49, 130, 246, 0.08)' : 'none',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* Card Header (Experiment ID + Selection Badge) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#333D4B', fontFamily: 'Lexend, sans-serif' }}>
                      🔬 {v.id}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3182F6', backgroundColor: '#E8F3FF', padding: '2px 8px', borderRadius: 4 }}>
                        선택됨
                      </span>
                    )}
                  </div>

                  {/* Card Body (Editable Text Area or Static Text) */}
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      style={{
                        width: '100%', height: 110, padding: 12, borderRadius: 6,
                        border: '1.5px solid #3182F6', fontSize: 14.5, lineHeight: 1.5,
                        boxSizing: 'border-box', marginBottom: 12, resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#333D4B', margin: '0 0 16px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {v.text}
                    </p>
                  )}

                  {/* Card Actions Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(v.id)}
                            style={{
                              padding: '6px 12px', backgroundColor: '#3182F6', color: '#FFF',
                              border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: '6px 12px', backgroundColor: '#F2F3F5', color: '#666',
                              border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(v.id, v.text)}
                            style={{
                              padding: '6px 12px', backgroundColor: '#F2F3F5', color: '#4E5968',
                              border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => regenerateSingleDraft(v.id, idx)}
                            disabled={isRegenerating}
                            style={{
                              padding: '6px 12px', backgroundColor: '#FFF', color: '#4E5968',
                              border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                              opacity: isRegenerating ? 0.6 : 1
                            }}
                          >
                            {isRegenerating ? '생성 중...' : '다시 생성'}
                          </button>
                        </>
                      )}
                    </div>
                    
                    {!isSelected && !isEditing && (
                      <button
                        onClick={() => setSelectedVariationId(v.id)}
                        style={{
                          padding: '6px 14px', backgroundColor: '#FFF', color: '#3182F6',
                          border: '1.5px solid #3182F6', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        선택하기
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Threads 발행 */}
      <button 
        onClick={publishToThreads} 
        disabled={isPublishing || !selectedVariationId}
        style={{
          width: '100%', padding: 16, backgroundColor: '#130537', color: '#FFF',
          borderRadius: 8, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
          opacity: (isPublishing || !selectedVariationId) ? 0.5 : 1,
          transition: 'all 0.2s', marginBottom: 12
        }}
      >
        {isPublishing ? '스레드 발행 중...' : '선택한 가설 초안 스레드 발행하기 🚀'}
      </button>

      {message && (
        <div style={{
          marginTop: 12, padding: 14, borderRadius: 8,
          backgroundColor: message.includes('에러') ? '#FEE2E2' : '#DCFCE7',
          color: message.includes('에러') ? '#991B1B' : '#166534',
          fontWeight: 600, textAlign: 'center', fontSize: 14
        }}>
          {message}
        </div>
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#333D4B', color: '#FFF', padding: '12px 24px', borderRadius: 30,
          fontSize: 14, fontWeight: 600, zIndex: 99999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toastMsg}
        </div>
      )}

      {/* --- Preserved Replies Section --- */}
      <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #E5E7EB' }} />
      
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>💬 스레드 댓글(답글) 관리</h2>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13.5 }}>최근 작성한 스레드에 달린 댓글을 불러오고 AI 답글을 달 수 있습니다.</p>
      
      <button 
        onClick={fetchRecentReplies} 
        disabled={isFetchingReplies}
        style={{
          width: '100%', padding: 13, backgroundColor: '#F3F4F6', color: '#374151',
          borderRadius: 8, fontSize: 14.5, fontWeight: 600, border: '1px solid #D1D5DB', cursor: 'pointer',
          marginBottom: 20
        }}
      >
        {isFetchingReplies ? '불러오는 중...' : '🔄 최근 포스팅 댓글 불러오기'}
      </button>

      {recentThread && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#4B5563' }}>
          <strong>최근 포스팅:</strong> {recentThread.text.substring(0, 50)}...
        </div>
      )}

      {replies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {replies.map(reply => (
            <div key={reply.id} style={{ padding: 16, border: '1px solid #E5E7EB', borderRadius: 8 }}>
              <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>👤 댓글: "{reply.text}"</p>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => generateReplyDraft(reply.id, reply.text)}
                  style={{
                    padding: '8px 12px', backgroundColor: '#E0E7FF', color: '#4338CA',
                    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ✨ AI 답글 초안 생성
                </button>
              </div>

              {replyDrafts[reply.id] !== undefined && (
                <>
                  <textarea
                    value={replyDrafts[reply.id]}
                    onChange={(e) => setReplyDrafts(prev => ({ ...prev, [reply.id]: e.target.value }))}
                    style={{
                      width: '100%', height: 100, padding: 12, borderRadius: 6,
                      border: '1px solid #D1D5DB', fontSize: 14, lineHeight: 1.5,
                      boxSizing: 'border-box', marginBottom: 12, resize: 'vertical'
                    }}
                  />
                  <button
                    onClick={() => publishReply(reply.id)}
                    style={{
                      width: '100%', padding: 12, backgroundColor: '#130537', color: '#FFF',
                      border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    🚀 이 답글 발행하기
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {replyMessage && (
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          backgroundColor: replyMessage.includes('에러') ? '#FEE2E2' : '#EFF6FF',
          color: replyMessage.includes('에러') ? '#991B1B' : '#1E40AF',
          fontSize: 13.5, fontWeight: 600, textAlign: 'center'
        }}>
          {replyMessage}
        </div>
      )}
      
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <a href="/" style={{ color: '#666', textDecoration: 'underline' }}>← 홈으로 돌아가기</a>
      </div>
    </div>
  );
}
