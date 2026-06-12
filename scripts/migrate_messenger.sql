-- Messenger: 멤버 추가 기능 마이그레이션
-- 추가된 사람은 추가 시점 이후의 메시지만 볼 수 있도록 joined_at 추적

-- 기존 messenger_conversations 테이블에 participant_joined_at jsonb 컬럼 추가
-- 형식: { "<user_id>": "<ISO timestamp>", ... }
ALTER TABLE messenger_conversations
  ADD COLUMN IF NOT EXISTS participant_joined_at jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 기존 대화방의 모든 참여자에 대해 created_at으로 joined_at 백필
-- (기존 멤버는 모든 메시지를 볼 수 있어야 하므로 대화방 생성 시점을 기준으로 함)
UPDATE messenger_conversations c
SET participant_joined_at = (
  SELECT COALESCE(jsonb_object_agg(p, to_jsonb(c.created_at)), '{}'::jsonb)
  FROM jsonb_array_elements_text(to_jsonb(c.participants)) AS p
)
WHERE participant_joined_at = '{}'::jsonb
  AND participants IS NOT NULL;
