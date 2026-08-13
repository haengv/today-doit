// api/daily_draft.js
// Vercel Serverless Function - triggered daily at 8PM KST (11:00 UTC) by cron

export default async function handler(req, res) {
  // Allow manual trigger via GET as well (for testing from browser)
  // Cron jobs are triggered as GET requests by Vercel

  const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
  const discordWebhookUrl = process.env.VITE_DISCORD_WEBHOOK_URL;
  const appUrl = process.env.VITE_APP_URL || 'https://today-doit.vercel.app';

  if (!geminiApiKey || !discordWebhookUrl) {
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  // Randomly pick a category each day
  const categories = ['empathy', 'service', 'motivation'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];

  const categoryLabels = {
    empathy: '🫂 공감 유도',
    service: '✨ 서비스 홍보',
    motivation: '🔥 동기부여',
  };

  let topicInstruction = '';
  if (randomCategory === 'empathy') {
    topicInstruction = '주제: 회피형 인간이나 할 일을 미루는 사람들의 뼈를 때리거나 깊은 공감을 유도하는 내용';
  } else if (randomCategory === 'service') {
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

  try {
    // 1. Generate draft with Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) throw new Error(geminiData.error?.message || 'Gemini API error');

    const draftText = geminiData.candidates[0].content.parts[0].text.trim();

    // 2. Build admin deep-link with draft pre-filled in URL
    const encodedDraft = encodeURIComponent(draftText);
    const adminLink = `${appUrl}/admin?draft=${encodedDraft}`;

    // 3. Send to Discord
    const now = new Date();
    const koreaTime = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);

    const discordPayload = {
      content: `📢 **오늘의 스레드 초안이 도착했어요!** (${koreaTime})\n카테고리: **${categoryLabels[randomCategory]}**\n\n✏️ 수정하고 발행하러 가기 → ${adminLink}`,
      embeds: [
        {
          color: 0x130537,
          title: '오늘의 초안 미리보기',
          description: draftText,
          footer: { text: '위 링크를 클릭하면 어드민 페이지에서 바로 이 초안으로 수정 & 발행할 수 있어요!' },
        },
      ],
    };

    const discordRes = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      throw new Error(`Discord webhook failed: ${errText}`);
    }

    return res.status(200).json({ success: true, category: randomCategory, draft: draftText });
  } catch (err) {
    console.error('[daily_draft] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
